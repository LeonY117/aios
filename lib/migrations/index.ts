import type { Migration } from "./types";
import { migration as m001 } from "./001_content_format";

export const migrations: Migration[] = [m001];
