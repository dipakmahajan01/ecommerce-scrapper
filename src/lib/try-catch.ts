export async function tryCatch<T>(
  promise: Promise<T>
): Promise<{ data?: T; error?: Error }> {
  try {
    const data = await promise;
    return { data };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
