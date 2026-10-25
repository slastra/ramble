<script setup lang="ts" generic="T extends TilingItem">
import type { VNode } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { TilingItem } from '../utils/tiling'

const props = withDefaults(defineProps<{
  items: T[]
  // localStorage key for the tile order and the main split
  storageKey: string
  // Space between tiles in px
  gap?: number
}>(), {
  gap: 8
})

const emit = defineEmits<{
  open: [id: string]
}>()

defineSlots<{
  default: (props: { item: T, isMain: boolean, dragging: boolean, makeMain: () => void }) => VNode[]
}>()

// Pixels a press has to travel before it's a drag rather than a click
const DRAG_THRESHOLD = 4
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

interface SavedTiling {
  order: string[]
  ratio: number
}
function load(): SavedTiling {
  try {
    const saved = JSON.parse(localStorage.getItem(props.storageKey) ?? '{}') as Partial<SavedTiling>
    return { order: saved.order ?? [], ratio: saved.ratio ?? 0.5 }
  } catch {
    return { order: [], ratio: 0.5 }
  }
}
const initial = load()
const order = ref<string[]>(initial.order)
const ratio = ref(initial.ratio)

function save() {
  try {
    localStorage.setItem(props.storageKey, JSON.stringify({ order: order.value, ratio: ratio.value }))
  } catch {
    // Private mode or full storage: the arrangement just won't survive a reload
  }
}

// Ids seen this visit, so only a genuinely new screen share jumps to the main slot
const seen = new Set<string>()
watch(() => props.items.map(item => item.id), () => {
  order.value = orderTiles(props.items, order.value, seen)
  props.items.forEach(item => seen.add(item.id))
}, { immediate: true })

const container = ref<HTMLElement>()
const { width, height } = useElementSize(container)
const aspect = computed(() => (width.value > 0 && height.value > 0 ? width.value / height.value : 16 / 9))
// What's on screen: the remembered order, minus tiles that aren't here right now
const shown = computed(() => {
  const present = new Set(props.items.map(item => item.id))
  return order.value.filter(id => present.has(id))
})
const tiling = computed(() => dwindle(shown.value, aspect.value, ratio.value))

const percent = (value: number) => `${value * 100}%`
function frameStyle(id: string) {
  const frame = tiling.value.frames[id]
  if (!frame) return { display: 'none' }
  return { left: percent(frame.x), top: percent(frame.y), width: percent(frame.w), height: percent(frame.h), padding: `${props.gap / 2}px` }
}

function makeMain(id: string) {
  const main = shown.value[0]
  if (!main || main === id) return
  order.value = swapTiles(order.value, main, id)
  save()
}

// Dragging a tile onto another swaps them; a press without movement opens it
interface Drag {
  id: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  target: string | null
}
const drag = ref<Drag | null>(null)

function tileAt(clientX: number, clientY: number): string | null {
  const box = container.value?.getBoundingClientRect()
  if (!box) return null
  const fx = (clientX - box.left) / box.width
  const fy = (clientY - box.top) / box.height
  for (const [id, frame] of Object.entries(tiling.value.frames)) {
    if (fx >= frame.x && fx < frame.x + frame.w && fy >= frame.y && fy < frame.y + frame.h) return id
  }
  return null
}

function onTileDown(event: PointerEvent, id: string) {
  if (event.button !== 0 || (event.target as Element).closest('[data-tile-ignore]')) return
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  drag.value = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, target: null }
}

function onTileMove(event: PointerEvent) {
  const active = drag.value
  if (!active || event.pointerId !== active.pointerId) return
  if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < DRAG_THRESHOLD) return
  active.moved = true
  const over = tileAt(event.clientX, event.clientY)
  active.target = over && over !== active.id ? over : null
}

function onTileUp(event: PointerEvent) {
  const active = drag.value
  if (!active || event.pointerId !== active.pointerId) return
  if (!active.moved) {
    emit('open', active.id)
  } else if (active.target) {
    order.value = swapTiles(order.value, active.id, active.target)
    save()
  }
  drag.value = null
}

// The main split's handle
const resizing = ref<number | null>(null)
const mainSplit = computed(() => tiling.value.mainSplit)

const handleStyle = computed(() => {
  const split = mainSplit.value
  if (!split) return null
  return split.axis === 'x'
    ? { left: percent(split.at), top: percent(split.span.y), height: percent(split.span.h) }
    : { top: percent(split.at), left: percent(split.span.x), width: percent(split.span.w) }
})

function onHandleDown(event: PointerEvent) {
  if (event.button !== 0) return
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  resizing.value = event.pointerId
}

function onHandleMove(event: PointerEvent) {
  const split = mainSplit.value
  const box = container.value?.getBoundingClientRect()
  if (resizing.value !== event.pointerId || !split || !box) return
  const position = split.axis === 'x'
    ? ((event.clientX - box.left) / box.width - split.span.x) / split.span.w
    : ((event.clientY - box.top) / box.height - split.span.y) / split.span.h
  ratio.value = Math.min(MAX_RATIO, Math.max(MIN_RATIO, position))
}

function onHandleUp(event: PointerEvent) {
  if (resizing.value !== event.pointerId) return
  resizing.value = null
  save()
}

function onHandleKeydown(event: KeyboardEvent) {
  const step = { ArrowLeft: -0.05, ArrowUp: -0.05, ArrowRight: 0.05, ArrowDown: 0.05 }[event.key]
  if (step === undefined) return
  event.preventDefault()
  ratio.value = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio.value + step))
  save()
}

// Animate tiles into new slots, except while the user is dragging the split
const animate = computed(() => resizing.value === null)
</script>

<template>
  <div
    ref="container"
    class="relative size-full"
    :class="(drag?.moved || resizing !== null) && 'select-none'"
    :style="{ padding: `${gap / 2}px` }"
  >
    <div class="relative size-full">
      <!-- Iterate the stable item list, not the order: moving a playing <video> in the DOM can pause it -->
      <div
        v-for="item in items"
        :key="item.id"
        class="absolute"
        :class="animate && 'transition-[left,top,width,height] duration-200 ease-out'"
        :style="frameStyle(item.id)"
      >
        <div
          class="relative size-full touch-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary transition-[opacity,scale] duration-150"
          :class="[
            drag?.moved && drag.id === item.id ? 'opacity-60 scale-[0.98] cursor-grabbing' : 'cursor-pointer',
            drag?.target === item.id && 'ring-2 ring-primary'
          ]"
          role="button"
          tabindex="0"
          :aria-label="item.label"
          @pointerdown="onTileDown($event, item.id)"
          @pointermove="onTileMove"
          @pointerup="onTileUp"
          @pointercancel="drag = null"
          @dragstart.prevent
          @keydown.enter.self.prevent="emit('open', item.id)"
        >
          <slot
            :item="item"
            :is-main="shown[0] === item.id && shown.length > 1"
            :dragging="drag?.moved === true && drag.id === item.id"
            :make-main="() => makeMain(item.id)"
          />

          <!-- Drop target -->
          <div
            v-if="drag?.target === item.id"
            class="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-primary/15"
          >
            <UBadge
              label="Swap"
              icon="i-lucide-arrow-left-right"
              color="primary"
              variant="solid"
              size="lg"
            />
          </div>
        </div>
      </div>

      <!-- Main split: drag (or focus and use arrow keys) to resize -->
      <div
        v-if="handleStyle && mainSplit"
        role="separator"
        :aria-orientation="mainSplit.axis === 'x' ? 'vertical' : 'horizontal'"
        :aria-valuenow="Math.round(ratio * 100)"
        aria-valuemin="20"
        aria-valuemax="80"
        aria-label="Main tile size"
        tabindex="0"
        class="group/split absolute z-10 flex touch-none items-center justify-center outline-none"
        :class="mainSplit.axis === 'x'
          ? '-translate-x-1/2 w-3 cursor-col-resize'
          : '-translate-y-1/2 h-3 cursor-row-resize'"
        :style="handleStyle"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="resizing = null"
        @keydown="onHandleKeydown"
      >
        <span
          class="rounded-full bg-primary opacity-0 transition-opacity group-hover/split:opacity-100 group-focus-visible/split:opacity-100"
          :class="[
            mainSplit.axis === 'x' ? 'h-10 w-1' : 'h-1 w-10',
            resizing !== null && 'opacity-100'
          ]"
        />
      </div>
    </div>
  </div>
</template>
