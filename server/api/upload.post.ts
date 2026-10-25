import { randomUUID } from 'crypto'
import { ALLOWED_FILE_TYPES } from '../constants/fileTypes'

interface UploadedFile {
  name: string
  type: string
  content: string
}

// Files arrive base64-encoded in a JSON body, so the largest allowed file (100MB)
// is ~134MB on the wire. Refuse anything bigger before reading it into memory.
const MAX_BODY_BYTES = 150 * 1024 * 1024
const UPLOAD_BYTES_PER_HOUR = 1024 * 1024 * 1024

export default defineEventHandler(async (event) => {
  try {
    const contentLength = Number(getHeader(event, 'content-length'))
    if (!contentLength || contentLength > MAX_BODY_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Upload is too large'
      })
    }
    rateLimit(event, 'upload', 30, 10 * 60_000)

    const { files } = await readBody<{ files: UploadedFile[] }>(event)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No files uploaded'
      })
    }

    // Validate every file before storing any, so the byte budget is charged up front
    const accepted = []
    for (const file of files) {
      if (!file.name || !file.content || !file.type) {
        continue
      }

      // Decode base64 content to get size
      const base64Data = file.content.split(',')[1] || file.content
      const buffer = Buffer.from(base64Data, 'base64')

      // Validate file type
      const allowedType = ALLOWED_FILE_TYPES[file.type]
      if (!allowedType) {
        throw createError({
          statusCode: 400,
          statusMessage: `File type ${file.type} is not allowed`
        })
      }

      // Validate file size
      if (buffer.length > allowedType.maxSize) {
        throw createError({
          statusCode: 400,
          statusMessage: `File ${file.name} exceeds maximum size of ${Math.round(allowedType.maxSize / 1024 / 1024)}MB`
        })
      }

      accepted.push({ file, size: buffer.length, allowedType })
    }
    const totalBytes = accepted.reduce((sum, { size }) => sum + size, 0)
    rateLimit(event, 'upload-bytes', UPLOAD_BYTES_PER_HOUR, 60 * 60_000, totalBytes)

    const uploadedFiles = []
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')

    for (const { file, size, allowedType } of accepted) {
      // Generate unique filename
      const fileId = randomUUID()
      const timestamp = Date.now()
      const extension = allowedType.ext
      // Don't include extension here - storeFileLocally adds it automatically from file.name
      const storageFilename = `${fileId}-${timestamp}`
      const storagePath = `/${year}/${month}`

      // Save file using nuxt-file-storage
      const fileToStore = {
        ...file,
        size: size.toString(),
        lastModified: Date.now().toString()
      }
      await storeFileLocally(
        fileToStore,
        storageFilename,
        storagePath
      )

      // The actual stored filename includes the extension from file.name
      const actualFilename = `${storageFilename}${extension}`

      // Create file metadata
      const fileUrl = `uploads${storagePath}/${actualFilename}`
      uploadedFiles.push({
        url: fileUrl,
        originalName: file.name,
        mimeType: file.type,
        size,
        type: allowedType.category,
        uploadedAt: now.toISOString()
      })
    }

    return {
      success: true,
      files: uploadedFiles
    }
  } catch (error: unknown) {
    console.error('[Upload] Error:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Upload failed'
    })
  }
})
