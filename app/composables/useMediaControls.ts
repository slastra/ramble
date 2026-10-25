import type { UseLiveKitRoomReturn } from './useLiveKitRoom'

export type MediaDeviceKind = 'audioInput' | 'videoInput' | 'audioOutput'

/**
 * Turning media on and off and choosing devices, for every control that does it
 * (toolbar, Settings, the empty video state). Failures, usually a denied permission
 * or a missing device, show a toast instead of a button that silently did nothing.
 * Chosen devices are remembered and re-applied on the next join.
 */
export function useMediaControls(liveKitRoom: UseLiveKitRoomReturn) {
  const devicePrefs = useDevicePreferences()
  const toast = useToast()

  async function attempt(action: () => Promise<void>, what: string) {
    try {
      await action()
    } catch (error) {
      toast.add({
        title: `Couldn't ${what}`,
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-lucide-circle-alert',
        color: 'error'
      })
    }
  }

  const setMicrophone = (on: boolean) =>
    attempt(() => liveKitRoom.enableMicrophone(on), on ? 'turn on the microphone' : 'mute the microphone')
  const setCamera = (on: boolean) =>
    attempt(() => liveKitRoom.enableCamera(on), on ? 'turn on the camera' : 'turn off the camera')
  const setScreenShare = (on: boolean) =>
    attempt(() => liveKitRoom.enableScreenShare(on), on ? 'share your screen' : 'stop sharing')

  const toggleMicrophone = () => setMicrophone(!liveKitRoom.isMicrophoneEnabled.value)
  const toggleCamera = () => setCamera(!liveKitRoom.isCameraEnabled.value)
  const toggleScreenShare = () => setScreenShare(!liveKitRoom.isScreenShareEnabled.value)

  function switchDevice(kind: MediaDeviceKind, deviceId: string) {
    switch (kind) {
      case 'audioInput': return liveKitRoom.switchMicrophone(deviceId)
      case 'videoInput': return liveKitRoom.switchCamera(deviceId)
      case 'audioOutput': return liveKitRoom.switchSpeaker(deviceId)
    }
  }

  const savedDevice = (kind: MediaDeviceKind) => {
    switch (kind) {
      case 'audioInput': return devicePrefs.microphone
      case 'videoInput': return devicePrefs.camera
      case 'audioOutput': return devicePrefs.speaker
    }
  }

  const deviceNoun: Record<MediaDeviceKind, string> = {
    audioInput: 'microphones',
    videoInput: 'cameras',
    audioOutput: 'speakers'
  }

  const chooseDevice = (kind: MediaDeviceKind, deviceId: string) => attempt(async () => {
    await switchDevice(kind, deviceId)
    savedDevice(kind).value = deviceId
  }, `switch ${deviceNoun[kind]}`)

  /** On join: put back the devices chosen last time. A device that's gone is skipped quietly. */
  async function applySavedDevices() {
    const kinds: MediaDeviceKind[] = liveKitRoom.supportsSpeakerSelection.value
      ? ['audioInput', 'videoInput', 'audioOutput']
      : ['audioInput', 'videoInput']
    for (const kind of kinds) {
      const deviceId = savedDevice(kind).value
      if (!deviceId) continue
      try {
        await switchDevice(kind, deviceId)
      } catch (error) {
        console.warn(`[Media] Saved ${deviceNoun[kind]} choice is unavailable:`, error)
      }
    }
  }

  return {
    setMicrophone,
    setCamera,
    setScreenShare,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    chooseDevice,
    applySavedDevices
  }
}
