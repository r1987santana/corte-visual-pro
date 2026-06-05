type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>
  | ClassValue[];

export function cn(...inputs: ClassValue[]) {
  const classes: string[] = [];

  const visit = (value: ClassValue) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled) classes.push(key);
      });
      return;
    }

    classes.push(String(value));
  };

  inputs.forEach(visit);
  return classes.join(" ");
}
