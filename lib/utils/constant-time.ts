function toUtf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function constantTimeEqualsUtf8(left: string, right: string): boolean {
  const leftBytes = toUtf8Bytes(left);
  const rightBytes = toUtf8Bytes(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index]! ^ rightBytes[index]!;
  }

  return mismatch === 0;
}
