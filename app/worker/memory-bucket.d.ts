// MEMORY_BUCKET binds only when R2 is on; wrangler types omits it on a no-R2 install.
// Declaring it optional keeps the worker typechecking. wiki/development/memory.md#without-r2
interface Env {
  MEMORY_BUCKET?: R2Bucket;
}
