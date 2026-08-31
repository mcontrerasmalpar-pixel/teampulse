// @ts-check

export function structuredError(code, message, extra = {}) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: { code, message, ...extra } }),
      },
    ],
    isError: true,
    structuredContent: {
      error: { code, message, ...extra },
    },
  };
}

export async function withTimeout(fn, timeoutMs, code = 'ETIMEDOUT') {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`Timeout after ${timeoutMs}ms`);
          Object.assign(err, { code });
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default { structuredError, withTimeout };
