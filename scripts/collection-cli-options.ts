/** Explicit zero disables that work lane; omitted caps keep configured defaults. */
export function collectionCliCaps(args: string[]) {
  const cap = (name: string) => {
    const option = args.find((arg) => arg.startsWith(`--${name}=`));
    if (option === undefined) return undefined;
    const text = option.slice(name.length + 3);
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`--${name} requires a nonnegative safe integer.`);
    return value;
  };
  return {
    smoke: args.includes("--smoke"),
    fresh: args.includes("--fresh"),
    pageCap: cap("pages"),
    detailCap: cap("details"),
  };
}
