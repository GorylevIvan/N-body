/* tslint:disable */
/* eslint-disable */

export class NBodyEngine {
    free(): void;
    [Symbol.dispose](): void;
    bodies_count(): number;
    kinetic_energy(): number;
    masses_ptr(): number;
    constructor(n: number, width: number, height: number, depth: number);
    positions_len(): number;
    positions_ptr(): number;
    potential_energy(): number;
    reset_collapse(): void;
    reset_explosion(): void;
    reset_galaxy(): void;
    reset_two_galaxies(): void;
    resize_world(width: number, height: number, depth: number): void;
    scalars_len(): number;
    set_params(g: number, dt: number, softening: number, bounce: number): void;
    set_solver_mode(mode: string): void;
    speeds_ptr(): number;
    step(): void;
    step_many(iterations: number): void;
    total_energy(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_nbodyengine_free: (a: number, b: number) => void;
    readonly nbodyengine_bodies_count: (a: number) => number;
    readonly nbodyengine_kinetic_energy: (a: number) => number;
    readonly nbodyengine_masses_ptr: (a: number) => number;
    readonly nbodyengine_new: (a: number, b: number, c: number, d: number) => number;
    readonly nbodyengine_positions_len: (a: number) => number;
    readonly nbodyengine_positions_ptr: (a: number) => number;
    readonly nbodyengine_potential_energy: (a: number) => number;
    readonly nbodyengine_reset_collapse: (a: number) => void;
    readonly nbodyengine_reset_explosion: (a: number) => void;
    readonly nbodyengine_reset_galaxy: (a: number) => void;
    readonly nbodyengine_reset_two_galaxies: (a: number) => void;
    readonly nbodyengine_resize_world: (a: number, b: number, c: number, d: number) => void;
    readonly nbodyengine_set_params: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly nbodyengine_set_solver_mode: (a: number, b: number, c: number) => void;
    readonly nbodyengine_speeds_ptr: (a: number) => number;
    readonly nbodyengine_step: (a: number) => void;
    readonly nbodyengine_step_many: (a: number, b: number) => void;
    readonly nbodyengine_total_energy: (a: number) => number;
    readonly nbodyengine_scalars_len: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
