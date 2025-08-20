# Asphalt Mix Optimisation MVP – Technical Model  
*(TfNSW R116 – Dense Graded Asphalt 14 mm)*  

## 1  Scope
• Mix type: Heavy Duty Dense Graded Asphalt, DGA14 only  
• Specification: Transport for NSW (TfNSW) R116  
• Goal: find the **lowest-cost** blend that satisfies grading and binder constraints  
• Platform: **browser-only** MVP (no backend) using javascript-lp-solver  

---

## 2  Decision Variables  
For each user-supplied material *i*  
 Pᵢ   = proportion of total mix mass (%)  

Material categories  
 • Virgin aggregate stockpiles  
 • RAP (includes aggregate + aged binder)  
 • Virgin binder  

---

## 3  Objective Function  
Minimise cost per tonne of finished mix  

C = Σ (Pᵢ × cᵢ) / 100   [$ t⁻¹]  

Because Σ Pᵢ = 100, the solver minimises **Σ Pᵢ cᵢ** directly.

---

## 4  Constraints  

1. Mass balance  
 Σ Pᵢ = 100  

2. Binder equality  
 P_binder  +  Σ\_{RAP} Pᵢ (RAP_binderᵢ / 100) = targetBinder %  

3. Non-negativity  
 Pᵢ ≥ 0 ∀ i  

4. Gradation envelope – linearised  
Let  
 aᵢ = 1           (virgin aggregate)  
 aᵢ = 1 − RAP_binderᵢ/100 (RAP)  
 aᵢ = 0           (binder)  

For each sieve *j* with lower L\_j and upper U\_j:

 Σ Pᵢ aᵢ (Gᵢⱼ − Lⱼ) ≥ 0       (lower bound)  
 Σ Pᵢ aᵢ (Gᵢⱼ − Uⱼ) ≤ 0       (upper bound)

These inequalities originate from multiplying both sides of  
 Lⱼ ≤ Combinedⱼ ≤ Uⱼ  
by total aggregate fraction  
 M\_agg = Σ Pᵢ aᵢ  
and moving terms to the left-hand side, preserving linearity for LP.

---

## 5  Combined Gradation (reporting)  
Combinedⱼ = [Σ Pᵢ aᵢ Gᵢⱼ] / [Σ Pᵢ aᵢ]    (% passing)

---

## 6  Volumetric Calculations (report-only in MVP)

Inputs (optional, default in brackets)  
 Gb = binder specific gravity (1.03)  
 Gsbᵢ = bulk SG of aggregate stockpile (2.65 if blank)  
 Gmb = bulk SG of compacted mix (user)  

Derived values  
 • Blended Gsb (harmonic mean):

  1 / Gsb_blend = Σ (Pᵢ aᵢ / 100) / Gsbᵢ   ⇨   Gsb_blend = M_agg / Σ(Pᵢ aᵢ / Gsbᵢ)

 • Aggregate fraction Ps = M_agg / 100  
 • Binder fraction   Pb = targetBinder / 100  

 • Maximum theoretical SG:  
  Gmm ≈ 1 / (Pb/Gb + Ps/Gsb_blend)

 • Air voids (if Gmb given):  
  Va = 100 × (1 − Gmb / Gmm)

 • Voids in mineral aggregate:  
  VMA = 100 − (Gmb × Ps / Gsb_blend × 100)

 • Voids filled with asphalt:  
  VFA = 100 × (VMA − Va) / VMA

Specification ranges used for pass/fail display  
 Va 3–5 %, VMA ≥ 14 %, VFA 65–80 %.

---

## 7  Solver & Implementation
• LP solved client-side with javascript-lp-solver (simplex).  
• All inputs captured in index.html; model built in pp.js; results visualised with Chart.js.  
• Gradation limits stored in specs/r116_dga14.json and can be edited for latest R116 values.

---

## 8  File Map (MVP)
`
web/
 ├─ index.html          – UI & form
 ├─ styles.css          – styling
 ├─ app.js              – LP model, solving, reporting
 └─ specs/
      └─ r116_dga14.json – sieve sizes & envelope
docs/
 └─ technical_model.md  – this document
`

---

## 9  Limitations & Future Work
• Envelope values are indicative; verify with current TfNSW R116 tables.  
• Volumetrics **not enforced** in optimisation; can be added by expanding input set (Gse, absorption, target Gmb) or switching to non-linear/hybrid solver.  
• No stockpile min/max, RAP caps, or job-specific restrictions yet.  
• Single objective (cost); future: CO₂ minimisation, performance indices.  
• No persistence or PDF report generation; add local storage / server + PDF export later.  
• Browser-only; migrate to Next.js + TypeScript + Tailwind stack once validated.
