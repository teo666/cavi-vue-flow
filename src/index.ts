/**
 * cavi-vue-flow — Vue Flow edges drawn as cavijs physics cables.
 *
 * provideCables() in the component rendering <VueFlow>, then CaviEdge as an
 * edge type, CaviConnectionLine in the #connection-line slot and,
 * optionally, CaviPointer inside <VueFlow>.
 */

export { Cable, CableWorld, directionOf } from './cable-world';
export type { CableStyle, CableWorldOptions, Direction, FrameScheduler } from './cable-world';
export { cableStyleOf, provideCables, useCables, useHandleCable } from './composables';
export type { HandleCable, ProvideCablesOptions } from './composables';
export { findHandle, handleCenter } from './anchor';
export type { Anchor } from './anchor';
export { default as CaviEdge } from './CaviEdge.vue';
export type { CaviEdgeData } from './CaviEdge.vue';
export { default as CaviConnectionLine } from './CaviConnectionLine.vue';
export { default as CaviPointer } from './CaviPointer.vue';
export { FlowHistory, flowSnapshot, useFlowHistory } from './history';
export type { FlowHistoryOptions, FlowState, UseFlowHistoryOptions } from './history';
