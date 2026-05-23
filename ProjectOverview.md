# Economy Atlas — Project Overview

## What We Are Building

An interactive visual map of the U.S. economy. The goal is to help users understand what industries and jobs exist, how they relate, how large they are, how fast they are growing, and where overlooked startup opportunities might live.

The product should feel like a graphical canvas or map, not a spreadsheet. Users can zoom, pan, search, and click into nodes.

Long-term vision:

> **Google Maps for the economy** — a visual tool for finding large, growing, fragmented, overlooked industries where new companies can be built.

---

## The Two Maps

### 1. Industry Map ("What kind of business is this?")

Backbone: **NAICS** — the official industry classification tree, from broad sectors down to specific categories.

```
United States
  → Information
    → Publishing Industries
      → Software Publishers

United States
  → Health Care and Social Assistance
    → Ambulatory Health Care Services
      → Offices of Dentists
```

For each industry we want to show:
- Size (GDP contribution, share of GDP)
- Employment, wages, number of establishments
- Growth (and whether it's shrinking)
- Fragmentation vs. concentration

This is the main surface for discovering startup opportunities.

### 2. Occupation Map ("What job does a person do?")

Backbone: **SOC / BLS occupation data**.

```
All Occupations
  → Computer and Mathematical
    → Software Developers
  → Healthcare Practitioners
    → Registered Nurses
    → Dentists
```

For each occupation: total employment, share of workforce, wages, and which industries employ them.

### The Industry ↔ Occupation Bridge

The most valuable feature is connecting the two maps:

- Click **Software Publishers** → see top occupations (developers, sales, support, managers, designers).
- Click **Software Developers** → see top employing industries (software publishers, computer systems design, finance, manufacturing, government).

---

## Product Experience

A web app with an interactive graphical canvas. Users can:
- Zoom and pan
- Click industry or occupation nodes to open a details panel
- Search for industries, jobs, or companies
- Change what node **size** represents (GDP, employment, growth, etc.)
- Change what node **color** represents
- Switch visual modes: treemap, graph/canvas, sunburst/hierarchy, search-first explorer, compare view

First version focuses on the Industry Map; Occupation Map comes after.

---

## Startup Opportunity Lens

Beyond exploration, the product should surface industries that are:
- Large, growing, fragmented
- Labor-heavy, full of operational pain
- Underserved by modern software
- Overlooked by typical startup founders

Examples of categories likely to be interesting: local service businesses, healthcare offices, logistics/transportation, construction trades, education services, specialty clinics, personal care, admin-heavy industries.

---

## Core Data Sources

### NAICS — Census
https://www.census.gov/naics

Industry tree, codes, descriptions, search keywords. Static files already in `data/` (2022 NAICS structure, descriptions, 2–6 digit codes).

### BEA GDP by Industry
https://www.bea.gov/itable/gdp-by-industry

Industry economic size, share of U.S. GDP, real growth over time. Local CSVs in `data/` (Value Added by Industry, % of GDP, Real Value Added).

### BLS — APIs and developer docs
https://www.bls.gov/developers/home.htm

BLS is the source for QCEW (employment, wages, establishments by industry), OEWS (occupation employment and wages, including by industry — powers the Occupation Map and the industry↔occupation bridge), and related series.

**API access:**
- Register/docs: https://www.bls.gov/developers/home.htm
- API signatures: https://www.bls.gov/developers/api_signature_v2.htm
- Endpoint: `https://api.bls.gov/publicAPI/v2/timeseries/data/`
- Auth: pass `registrationkey` in the POST body. Our key lives in `.env` as `BLS_API_KEY` (server-side only — never expose to the client).
- Registered v2 limits: 500 queries/day, up to 50 series per query, 20 years per query.

Prefer the API for any series we need to keep fresh. Static QCEW snapshot already in `data/2025.q1-q3.by_area/` for offline work.

### Census County Business Patterns (CBP)
https://www.census.gov/programs-surveys/cbp/data/datasets.html

Establishment counts, employment, payroll, small-business density — useful for finding local-business-heavy industries.

### Census Economic Census
https://www.census.gov/data/developers/data-sets/economic-census.html

Deeper business data later: revenue/receipts, firm counts, firm/establishment size, concentration of largest firms. Important for fragmentation analysis.

---

## Final Vision

Let someone visually explore the economy and answer:
- What industries exist in the U.S.?
- Which are largest? Growing fastest? Employ the most people? Have the most businesses?
- Which jobs exist inside each industry?
- Which industries are fragmented and overlooked?
- Where could a new startup be built?

Short-term: an interactive industry atlas. Long-term: an economy-wide startup opportunity discovery engine.
