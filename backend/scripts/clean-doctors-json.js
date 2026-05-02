import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/constants/doctors.json");
const OUTPUT = path.join(__dirname, "../src/constants/doctors.cleaned.json");

const OUTPUT_KEYS = [
  "hospitalName",
  "specialization",
  "locationCity",
  "region",
  "address",
  "contactNumber",
];

/** @type {Record<string, string | null>} */
const HEADER_TO_CANONICAL = {
  hospital: "hospitalName",
  hospitalname: "hospitalName",
  hospital_name: "hospitalName",
  facility: "hospitalName",
  facility_name: "hospitalName",
  clinic: "hospitalName",
  provider: "hospitalName",
  provider_name: "hospitalName",
  institution: "hospitalName",
  doctor: null,
  doctors: null,
  physician: null,
  physicians: null,
  name_of_doctor: null,
  contact_person: null,
  specialization: "specialization",
  specialty: "specialization",
  type: "specialization",
  type_of_facility: "specialization",
  discipline: "specialization",
  service: "specialization",
  location: "locationCity",
  city: "locationCity",
  municipality: "locationCity",
  town: "locationCity",
  region: "region",
  province: "region",
  address: "address",
  street: "address",
  street_address: "address",
  location_address: "address",
  contact: "contactNumber",
  contact_number: "contactNumber",
  contact_no: "contactNumber",
  contactnumber: "contactNumber",
  phone: "contactNumber",
  telephone: "contactNumber",
  mobile: "contactNumber",
  tel: "contactNumber",
  tel_no: "contactNumber",
  cellphone: "contactNumber",
  cell: "contactNumber",
  landline: "contactNumber",
  fax: "contactNumber",
  email: null,
  e_mail: null,
};

function normalizeHeaderLabel(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function labelToCamelCase(label) {
  const cleaned = String(label ?? "")
    .trim()
    .replace(/[^\w\s\-]/g, " ")
    .split(/[\s_\-]+/)
    .filter(Boolean);
  if (!cleaned.length) return "field";
  return cleaned
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

function uniqueCamelKeys(headerLabels) {
  const seen = new Map();
  return headerLabels.map((label) => {
    let base = labelToCamelCase(label);
    if (!base) base = "field";
    let key = base;
    let n = 1;
    while (seen.has(key)) {
      n += 1;
      key = `${base}${n}`;
    }
    seen.set(key, true);
    return key;
  });
}

function resolveCanonical(normalized) {
  if (normalized in HEADER_TO_CANONICAL) {
    return HEADER_TO_CANONICAL[normalized];
  }
  if (
    normalized.includes("contact") &&
    (normalized.includes("person") || normalized.includes("name"))
  ) {
    return null;
  }
  if (
    normalized.includes("hospital") ||
    normalized.includes("clinic") ||
    normalized.includes("facility") ||
    normalized.includes("provider") ||
    normalized.includes("institution")
  ) {
    return "hospitalName";
  }
  if (
    normalized.includes("special") ||
    normalized.includes("discipline") ||
    (normalized.includes("service") && !normalized.includes("address")) ||
    normalized === "type"
  ) {
    return "specialization";
  }
  if (
    normalized.includes("city") ||
    (normalized.includes("location") &&
      !normalized.includes("address") &&
      !normalized.includes("street"))
  ) {
    return "locationCity";
  }
  if (normalized.includes("region") || normalized.includes("province")) {
    return "region";
  }
  if (normalized.includes("address") || normalized.includes("street")) {
    return "address";
  }
  if (
    normalized.includes("contact") ||
    normalized.includes("phone") ||
    normalized.includes("tel") ||
    normalized.includes("mobile") ||
    normalized.includes("cell") ||
    normalized.includes("landline") ||
    normalized.includes("fax")
  ) {
    return "contactNumber";
  }
  if (normalized.includes("doctor") || normalized.includes("physician")) {
    return null;
  }
  if (normalized.includes("email") || normalized.includes("e_mail")) {
    return null;
  }
  return null;
}

function emptyProvider() {
  return {
    hospitalName: "",
    specialization: "",
    locationCity: "",
    region: "",
    address: "",
    contactNumber: "",
  };
}

function isProviderEmpty(p) {
  return OUTPUT_KEYS.every((k) => !String(p[k] ?? "").trim());
}

/**
 * Expand colspan into repeated slots so column indices align with header count.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} tr
 */
function expandRowCells($, tr) {
  const cells = [];
  $(tr)
    .children("th, td")
    .each((_, el) => {
      const $el = $(el);
      const text = $el.text().replace(/\u00a0/g, " ").trim();
      let span = parseInt(String($el.attr("colspan") || "1"), 10);
      if (!Number.isFinite(span) || span < 1) span = 1;
      for (let i = 0; i < span; i += 1) {
        cells.push(text);
      }
    });
  if (!cells.length) {
    $(tr)
      .children()
      .each((_, el) => {
        cells.push($(el).text().replace(/\u00a0/g, " ").trim());
      });
  }
  return cells;
}

function mergeField(p, canon, val) {
  const v = String(val ?? "").trim();
  if (!v) return;
  if (canon === "address" || canon === "contactNumber") {
    if (!p[canon]) p[canon] = v;
    else if (!p[canon].includes(v)) p[canon] = `${p[canon]}; ${v}`;
    return;
  }
  if (!p[canon]) p[canon] = v;
}

function applyHeaderValue(p, headerLabel, val) {
  const norm = normalizeHeaderLabel(headerLabel);
  const canon = resolveCanonical(norm);
  if (!canon) return;
  mergeField(p, canon, val);
}

function heuristicFillFromOrphans(p, orphans) {
  for (const cell of orphans) {
    const t = String(cell ?? "").trim();
    if (!t) continue;
    const digits = t.replace(/\D/g, "");
    if (
      !p.contactNumber &&
      digits.length >= 7 &&
      /^[\d\s\-+()./]{7,}$/.test(t)
    ) {
      mergeField(p, "contactNumber", t);
      continue;
    }
    if (
      !p.address &&
      (/\b(st|street|ave|avenue|road|brgy|barangay|blk|lot)\b/i.test(t) ||
        (t.length >= 12 && /[,#]/.test(t)))
    ) {
      mergeField(p, "address", t);
    }
  }
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').CheerioAPI} $table
 * @param {{ page: number; tableIndex: number }} ctx
 */
function extractProvidersFromTable($, $table, ctx) {
  const providers = [];
  const rows = $table.find("tr").toArray();
  if (!rows.length) {
    console.warn(
      `[skip] page ${ctx.page} table ${ctx.tableIndex}: no rows`,
    );
    return providers;
  }

  const headerCells = expandRowCells($, rows[0]).map((h) => h.trim());
  if (!headerCells.length) {
    console.warn(
      `[skip] page ${ctx.page} table ${ctx.tableIndex}: empty header row`,
    );
    return providers;
  }

  if ($table.find("[rowspan]").length) {
    console.warn(
      `[warn] page ${ctx.page} table ${ctx.tableIndex}: rowspan detected; alignment may be off`,
    );
  }

  const headerCamelKeys = uniqueCamelKeys(headerCells);
  const tableFieldsPresent = new Set();
  for (const h of headerCells) {
    const c = resolveCanonical(normalizeHeaderLabel(h));
    if (c) tableFieldsPresent.add(c);
  }

  const bodyRows = rows.slice(1);
  let rowNum = 0;
  for (const tr of bodyRows) {
    rowNum += 1;
    let cells = expandRowCells($, tr);
    if (!cells.length) {
      console.warn(
        `[skip] page ${ctx.page} table ${ctx.tableIndex} row ${rowNum}: no cells`,
      );
      continue;
    }

    const hLen = headerCells.length;
    const orphans = cells.length > hLen ? cells.slice(hLen) : [];
    if (cells.length !== hLen) {
      console.warn(
        `[column-mismatch] page ${ctx.page} table ${ctx.tableIndex} row ${rowNum}: ${cells.length} cells vs ${hLen} headers`,
      );
    }
    if (cells.length < hLen) {
      cells = [...cells, ...Array(hLen - cells.length).fill("")];
    } else if (cells.length > hLen) {
      cells = cells.slice(0, hLen);
    }

    /** @type {Record<string, string>} */
    const rowByCamel = {};
    for (let i = 0; i < hLen; i += 1) {
      rowByCamel[headerCamelKeys[i]] = String(cells[i] ?? "").trim();
    }

    const p = emptyProvider();
    for (let i = 0; i < hLen; i += 1) {
      applyHeaderValue(p, headerCells[i], cells[i]);
    }
    heuristicFillFromOrphans(p, orphans);

    if (isProviderEmpty(p)) {
      console.warn(
        `[skip] page ${ctx.page} table ${ctx.tableIndex} row ${rowNum}: no mapped fields`,
      );
      continue;
    }

    if (tableFieldsPresent.has("address") && !String(p.address).trim()) {
      console.warn(
        `[missing-address] page ${ctx.page} table ${ctx.tableIndex} row ${rowNum}: header had address column; value empty — ${JSON.stringify(rowByCamel)}`,
      );
    }
    if (
      tableFieldsPresent.has("contactNumber") &&
      !String(p.contactNumber).trim()
    ) {
      console.warn(
        `[missing-contactNumber] page ${ctx.page} table ${ctx.tableIndex} row ${rowNum}: header had contact column; value empty — ${JSON.stringify(rowByCamel)}`,
      );
    }

    for (const k of OUTPUT_KEYS) {
      if (p[k] === undefined || p[k] === null) p[k] = "";
    }

    providers.push(p);
  }

  return providers;
}

/**
 * @param {string} html
 * @param {{ page: number }} ctx
 */
function extractFromTableHtml(html, ctx) {
  const all = [];
  let tableIndex = 0;
  try {
    const $ = cheerio.load(html ?? "", { decodeEntities: true });
    let tables = $("table").toArray();
    if (!tables.length) {
      const wrapped = `<table>${html}</table>`;
      const $2 = cheerio.load(wrapped, { decodeEntities: true });
      tables = $2("table").toArray();
      if (!tables.length) {
        console.warn(`[skip] page ${ctx.page}: no <table> in md`);
        return all;
      }
      for (const t of tables) {
        tableIndex += 1;
        try {
          all.push(
            ...extractProvidersFromTable($2, $2(t), { ...ctx, tableIndex }),
          );
        } catch (e) {
          console.warn(
            `[skip] page ${ctx.page} table ${tableIndex}:`,
            e.message,
          );
        }
      }
      return all;
    }
    for (const t of tables) {
      tableIndex += 1;
      try {
        all.push(...extractProvidersFromTable($, $(t), { ...ctx, tableIndex }));
      } catch (e) {
        console.warn(
          `[skip] page ${ctx.page} table ${tableIndex}:`,
          e.message,
        );
      }
    }
  } catch (e) {
    console.warn(`[skip] page ${ctx.page}: cheerio load failed:`, e.message);
  }
  return all;
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(INPUT, "utf8");
  } catch (e) {
    console.error("Failed to read input:", e.message);
    process.exitCode = 1;
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in doctors.json:", e.message);
    process.exitCode = 1;
    return;
  }

  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const providers = [];

  for (const page of pages) {
    const pageNum = page?.page_number ?? page?.pageNumber ?? "?";
    const items = Array.isArray(page?.items) ? page.items : [];
    for (const item of items) {
      if (item?.type !== "table" || typeof item?.md !== "string") continue;
      providers.push(...extractFromTableHtml(item.md, { page: pageNum }));
    }
  }

  try {
    await fs.writeFile(
      OUTPUT,
      JSON.stringify({ providers }, null, 2),
      "utf8",
    );
  } catch (e) {
    console.error("Failed to write output:", e.message);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Wrote ${providers.length} providers to ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

main();
