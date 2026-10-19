export interface Exception {
  package?: string;
  path?: string;
  version: string;
  reason: string;
  reviewer: string;
  date: string;
  // LR-4: for a dual-licensed artefact, the non-GPL alternative its own licence files grant.
  elected?: string;
}
export interface Asset {
  licenceFile: string;
  licence: string;
  attribution: string;
}
export interface OpenItem { candidate: string; question: string; asked: string; status: string }
export interface Artefact {
  name: string;
  kind: 'npm' | 'font' | 'asset' | 'wasm' | 'first-party' | 'bundler';
  version: string;
  licence: string;
  licenceFiles: string[];
  notices: string[];
  shippedFiles: string[];
  exceptions?: Exception[];
}
export interface Shipped extends Omit<Artefact, 'licence'> {
  source?: string;
  texts: string[];
  problem?: string;
}
export interface Denylist { packagePatterns: string[]; byteStrings: string[] }
export interface Bom {
  generated: string;
  artefacts: Artefact[];
  openItems: OpenItem[];
  violations: string[];
}

// LR-7: every grant a licence text makes, read from the primary grant, never package metadata
// or bundled licence appendices. A dual-licensed text yields GPL-family and its alternative.
export function grantsIn(text: string): string[] {
  const primary = text.split(/^# Licenses of bundled dependencies\s*$/m)[0];
  const t = primary.replace(/\s+/g, ' ');
  const grants: string[] = [];
  if (/\b(?:GNU (?:Affero |Lesser |Library )?General Public License|A?GPL|LGPL)(?:\b|[- ])/i.test(t)) grants.push('GPL-family');
  if (/SIL OPEN FONT LICENSE.*Version 1\.1/i.test(t)) grants.push('OFL-1.1');
  if (/Apache License.*Version 2\.0/i.test(t) && /TERMS AND CONDITIONS|apache\.org\/licenses\/LICENSE-2\.0/i.test(t)) grants.push('Apache-2.0');
  if (/Permission is hereby granted, free of charge/i.test(t) && /deal in the Software without restriction/i.test(t) && /this permission notice shall be included/i.test(t)) grants.push('MIT');
  if (/Permission to use, copy, modify, and(?:\/or)? distribute this software for any purpose with or without fee is hereby granted/i.test(t)) {
    if (/copyright notice and this permission notice appear/i.test(t)) grants.push('ISC');
    else if (/THE SOFTWARE IS PROVIDED "AS IS"/i.test(t)) grants.push('0BSD');
  }
  if (/Redistribution and use in source and binary forms.*are permitted/i.test(t) && /Redistributions of source code must retain/i.test(t) && /Redistributions in binary form must reproduce/i.test(t)) {
    grants.push(/Neither the name|names of its contributors may be used/i.test(t) ? 'BSD-3-Clause' : 'BSD-2-Clause');
  }
  if (/This is free and unencumbered software released into the public domain/i.test(t) && /Anyone is free to copy, modify, publish, use, compile, sell, or distribute/i.test(t)) grants.push('Unlicense');
  return grants;
}

// LR-4: any GPL-family grant outranks the others until an owner-reviewed election says otherwise.
export function classifyLicence(text: string): string {
  const grants = grantsIn(text);
  return grants.includes('GPL-family') ? 'GPL-family' : grants[0] ?? 'no explicit grant';
}

// LR-3 / US-46.4: these tripwires are never eligible for an exception.
export function scanBytes(files: { path: string; bytes: Uint8Array }[], denylist: Denylist): string[] {
  return files.flatMap(file => denylist.byteStrings.filter(value => Buffer.from(file.bytes).includes(Buffer.from(value)))
    .map(value => `${file.path}: prohibited bytes ${value}`));
}

// LR-3: a prohibited name anywhere in a shipped module's path, not only in its package name.
export function prohibitedPaths(paths: string[], denylist: Denylist): string[] {
  return [...new Set(paths)].filter(file => denylist.packagePatterns.some(pattern => new RegExp(pattern, 'i').test(file)))
    .map(file => `${file}: prohibited path (LR-3)`);
}

export function buildBom(shipped: Shipped[], allowList: Exception[], assets: Record<string, Asset>, openItems: OpenItem[], denylist: Denylist, generated = new Date().toISOString()): Bom {
  const violations: string[] = [];
  const valid = allowList.filter(entry => {
    if (!entry.reason?.trim() || !entry.reviewer?.trim() || !entry.version || !entry.date || Boolean(entry.package) === Boolean(entry.path)) {
      violations.push(`Invalid allow-list entry: ${entry.package ?? entry.path ?? '(unnamed)'}; package or path, version, reason, reviewer and date required`);
      return false;
    }
    return true;
  });
  const artefacts = shipped.map(item => {
    const { texts, source, problem, ...fields } = item;
    if (problem) violations.push(problem);
    const registered = source ? assets[source] : undefined;
    if ((item.kind === 'asset' || item.kind === 'wasm') && !registered) violations.push(`${item.name}: undeclared asset`);
    // US-46.1: every non-bundler artefact records a version, commit or content hash.
    if (item.kind !== 'bundler' && item.version === 'unknown') violations.push(`${item.name}: unknown version (US-46.1)`);
    if (denylist.packagePatterns.some(pattern => new RegExp(pattern, 'i').test(item.name))) violations.push(`${item.name}: prohibited package (LR-3)`);
    // LR-7: a NOTICE attributes bundled code; its grants are not the artefact's own. A GPL
    // mention there still counts (LR-4), so only permissive grants are taken from licence files.
    const isNotice = (index: number) => /(?:^|\/)NOTICE[^/]*$/i.test(item.licenceFiles[index] ?? '');
    const own = texts.filter((_, index) => !isNotice(index));
    const grants = own.map(classifyLicence);
    const unknownGrant = !grants.some(grant => grant !== 'no explicit grant') || grants.includes('no explicit grant');
    const noticeGpl = texts.some((text, index) => isNotice(index) && classifyLicence(text) === 'GPL-family');
    const gpl = grants.includes('GPL-family') || noticeGpl;
    const licence = item.kind === 'first-party' ? 'first-party (owner; distribution model D2 open)'
      : gpl ? 'GPL-family' : [...new Set(grants.filter(grant => grant !== 'no explicit grant'))].join(' AND ') || 'no explicit grant';
    const artefact: Artefact = { ...fields, licence };
    if (registered && registered.licence !== licence) violations.push(`${item.name}: registered licence does not match licence file`);
    const covers = (entry: Exception) => entry.version === item.version && (entry.package === item.name || (entry.path !== undefined && entry.path === source));
    const applied: Exception[] = [];
    let cleared = !gpl;
    if (gpl) {
      // LR-4: a dual-licensed artefact may ship under a reviewed election of a non-GPL grant that
      // its own licence files make; GPL-only code, and GPL found in a NOTICE, never ships.
      const alternatives = own.flatMap(grantsIn).filter(grant => grant !== 'GPL-family');
      const election = noticeGpl ? undefined : valid.find(entry => covers(entry) && entry.elected !== undefined && alternatives.includes(entry.elected));
      if (election) {
        artefact.licence = `${election.elected} (elected; also GPL-family)`;
        applied.push(election);
        cleared = true;
      } else violations.push(`${item.name}: GPL-family licence in browser distribution (LR-4)`);
    }
    // LR-2: an election covers the GPL alternative only; an unrecognised licence file still needs
    // its own missing-grant exception.
    if (item.kind !== 'first-party' && cleared && unknownGrant) {
      const exception = valid.find(entry => covers(entry) && entry.elected === undefined);
      if (exception) applied.push(exception);
      else violations.push(`${item.name}: no explicit grant (LR-2 / LR-7)`);
    }
    if (applied.length) artefact.exceptions = applied;
    return artefact;
  });
  return { generated, artefacts, openItems, violations };
}

// US-46.1: retain full notices; repeated modules of a package share one attribution.
export function renderNotice(bom: Bom): string {
  const seen = new Set<string>();
  return bom.artefacts.filter(item => item.kind !== 'first-party').map(item => {
    const notices = item.notices.filter(text => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
    return `${item.name} ${item.version} — ${item.licence}\n${notices.join('\n\n')}`;
  }).join('\n\n========================================\n\n') + '\n';
}
