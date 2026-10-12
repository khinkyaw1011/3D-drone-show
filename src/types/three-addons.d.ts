import 'three/addons/math/MeshSurfaceSampler.js';

// @types/three omits this method (present in three since r150).
declare module 'three/addons/math/MeshSurfaceSampler.js' {
  interface MeshSurfaceSampler {
    setRandomGenerator(randomFunction: () => number): this;
  }
}
