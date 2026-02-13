type WellInfo = {
  WELL?: string;
  STRT?: number;
  STOP?: number;
  STEP?: number;
};

export function parseLAS(content: string) {
  const lines = content.split(/\r?\n/);

  let section = "";
  const well: WellInfo = {};
  const curves: { name: string; unit: string }[] = [];
  const data: { Depth: number; [key: string]: number }[] = [];

  let curveNames: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // Detect section
    if (line.startsWith("~")) {
      section = line.toUpperCase();
      continue;
    }

    // -----------------------------
    // WELL INFORMATION BLOCK
    // -----------------------------
    if (section.includes("WELL")) {
      // Example:
      // STRT.F          8665.00:  START DEPTH

      const beforeColon = line.split(":")[0].trim();
      const parts = beforeColon.split(/\s+/);

      if (parts.length >= 2) {
        const mnemonic = parts[0].split(".")[0].trim();
        const value = parts[1]?.trim();

        if (!value) continue;

        if (mnemonic === "WELL") well.WELL = value;
        if (mnemonic === "STRT") well.STRT = Number(value);
        if (mnemonic === "STOP") well.STOP = Number(value);
        if (mnemonic === "STEP") well.STEP = Number(value);
      }
    }

    // -----------------------------
    // CURVE INFORMATION BLOCK
    // -----------------------------
    if (section.includes("CURVE")) {
      // Example:
      // Depth          .F      :  Track # 0

      const beforeColon = line.split(":")[0].trim();
      const parts = beforeColon.split(/\s+/);

      if (parts.length >= 2) {
        const mnemonic = parts[0].trim();
        const unit = parts[1].replace(".", "").trim();

        curves.push({
          name: mnemonic,
          unit: unit || ""
        });

        curveNames.push(mnemonic);
      }
    }

    // -----------------------------
    // ASCII DATA BLOCK
    // -----------------------------
    if (section.includes("ASCII")) {
      const values = line.split(/\s+/).map(Number);

      if (values.length !== curveNames.length) continue;

      const row: any = {};

      values.forEach((value, index) => {
        if (index === 0) {
          row.Depth = value;
        } else {
          row[curveNames[index]] = value;
        }
      });

      data.push(row);
    }
  }

  return {
    well,
    curves,
    data
  };
}