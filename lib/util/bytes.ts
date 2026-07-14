function bytes(input: unknown): number | null {
  if (typeof input === "number") {
    return input;
  } else if (typeof input !== "string") {
    return null;
  }

  let unit = 1;
  if (input.toLowerCase().includes("kb")) {
    unit = 1024;
  } else if (input.toLowerCase().includes("mb")) {
    unit = 1024 ** 2;
  } else if (input.toLowerCase().includes("gb")) {
    unit = 1024 ** 3;
  } else if (input.toLowerCase().includes("tb")) {
    unit = 1024 ** 4;
  }

  const match = /\d+/.exec(input);

  if (!match) {
    return null;
  }

  const [digits] = match;

  if (digits === undefined) {
    return null;
  }

  const number = Number.parseInt(digits, 10);

  if (Number.isNaN(number)) {
    return null;
  }

  return number * unit;
}

export = bytes;
