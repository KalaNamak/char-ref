/* ==========================================================================
   Character Reference Builder — app logic
   Organised in four parts: state + simple field bindings, paragraphs,
   signature (draw/type), then rendering (live preview + PDF export).

   COMMON CUSTOMISATIONS
   ----------------------------------------------------------------------
   Add a form field:
     1. Add the input to index.html inside a `.field` wrapper.
     2. Add its key to `state` below and to the `simpleFields` array
        (skip that step if it needs custom logic, like `caseNumber` does).
     3. Add a line in `renderPreview()` so it shows in the live preview.
     4. Add a line in `buildPdfBlob()` so it appears in the PDF.
     5. If it's required, add its key to `requiredFields` and a label in
        `fieldLabels`.

   Change the letter wording/order:
     Edit `renderPreview()` (screen) and `buildPdfBlob()` (PDF) — keep
     them in the same order so the preview matches the download.

   Change fonts/colours/layout:
     See styles.css — the palette and fonts are CSS variables and
     comments at the top of that file.
   ========================================================================== */

(function () {
  "use strict";

  // ---------- state ----------
  const state = {
    name: "", address: "", phone: "", email: "", date: "",
    relationship: "", defendant: "", court: "", charge: "", caseNumber: "",
    profession: "", yearsKnown: "",
    opening: "", openingTouched: false,
    paragraphs: [""],
    sigMode: "draw",
    typedSig: "",
    hasDrawing: false
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  document.getElementById("f-date").value = todayISO;
  state.date = todayISO;

  // ---------- simple field bindings ----------
  const simpleFields = ["name", "address", "phone", "email", "date", "relationship", "defendant", "court", "charge", "profession", "yearsKnown"];
  simpleFields.forEach(key => {
    const el = document.getElementById("f-" + key);
    el.addEventListener("input", () => {
      state[key] = el.value;
      syncOpeningIfNeeded();
      renderPreview();
      validate();
    });
  });
  const caseEl = document.getElementById("f-case");
  caseEl.addEventListener("input", () => {
    state.caseNumber = caseEl.value;
    syncOpeningIfNeeded();
    renderPreview();
    validate();
  });

  // ---------- paragraphs ----------
  const paraList = document.getElementById("paragraphList");
  const addParaBtn = document.getElementById("addPara");

  function renderParagraphs() {
    paraList.innerHTML = "";
    state.paragraphs.forEach((val, i) => {
      const row = document.createElement("div");
      row.className = "paragraph-row";

      const ta = document.createElement("textarea");
      ta.value = val;
      ta.placeholder = i === 0
        ? "How long have you known the defendant, and in what context?"
        : "Add another point — specific examples carry the most weight.";
      ta.addEventListener("input", () => {
        state.paragraphs[i] = ta.value;
        renderPreview();
        validate();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "p-remove";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove paragraph";
      removeBtn.disabled = state.paragraphs.length <= 1;
      removeBtn.addEventListener("click", () => {
        if (state.paragraphs.length <= 1) return;
        state.paragraphs.splice(i, 1);
        renderParagraphs();
        renderPreview();
        validate();
      });

      row.appendChild(ta);
      row.appendChild(removeBtn);
      paraList.appendChild(row);
    });
  }

  addParaBtn.addEventListener("click", () => {
    state.paragraphs.push("");
    renderParagraphs();
    validate();
    const textareas = paraList.querySelectorAll("textarea");
    textareas[textareas.length - 1].focus();
  });

  renderParagraphs();

  // ---------- signature: draw ----------
  const canvas = document.getElementById("sigCanvas");
  const ctx = canvas.getContext("2d");
  let drawing = false, lastX = 0, lastY = 0;

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const prevData = state.hasDrawing ? canvas.toDataURL() : null;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1E2621";
    if (prevData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prevData;
    }
  }
  window.addEventListener("resize", fitCanvas);
  fitCanvas();

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  canvas.addEventListener("pointerdown", e => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    lastX = p.x; lastY = p.y;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    state.hasDrawing = true;
  });
  canvas.addEventListener("pointermove", e => {
    if (!drawing) return;
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  });
  function endStroke() {
    if (!drawing) return;
    drawing = false;
    renderPreview();
    validate();
  }
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointerleave", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  document.getElementById("clearSig").addEventListener("click", () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    state.hasDrawing = false;
    renderPreview();
    validate();
  });

  // ---------- signature: type ----------
  const typedSigInput = document.getElementById("typedSig");
  typedSigInput.addEventListener("input", () => {
    state.typedSig = typedSigInput.value;
    renderPreview();
    validate();
  });

  // ---------- signature tabs ----------
  document.querySelectorAll(".sig-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sig-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".sig-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      state.sigMode = tab.dataset.mode;
      document.querySelector('.sig-pane[data-pane="' + state.sigMode + '"]').classList.add("active");
      renderPreview();
      validate();
    });
  });

  // ---------- helpers ----------
  function esc(str) {
    return (str || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function formatDateLong(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function placeholderOr(val, ph) {
    return val && val.trim() ? esc(val) : '<span class="placeholder">' + esc(ph) + "</span>";
  }
  function firstName(full) {
    return (full || "").trim().split(/\s+/)[0] || "";
  }

  // ---------- opening paragraph: editable draft ----------
  // Pre-filled from the details entered elsewhere in the form, but it's a
  // normal editable textarea — not baked-in fixed text — so the person
  // signing the letter can (and should) rewrite it in their own words.
  // Deliberately generated as a single flowing paragraph rather than
  // several short ones, to leave more of the page free for the person's
  // own reference points — Crown Court references are generally best
  // kept to one page.
  // It re-generates automatically as the details above change, but only
  // until the person edits it directly; after that it's left alone unless
  // they click "Regenerate".
  const openingTextarea = document.getElementById("f-opening");
  const regenOpeningBtn = document.getElementById("regenOpening");

  function generateOpeningDraft() {
    const refFirst = firstName(state.name) || "[your first name]";
    const defFirst = firstName(state.defendant) || "[defendant's first name]";
    const defFull = state.defendant.trim() || "[defendant's name]";
    const profession = state.profession.trim() || "[profession]";
    const relationship = state.relationship.trim() || "[relationship]";
    const years = String(state.yearsKnown || "").trim() || "[number of]";
    const caseNo = state.caseNumber.trim() || "[case number]";

    return (
      "My name is " + refFirst + ", I am a " + profession + " and " + defFull + "'s " + relationship + ". " +
      "I have known " + defFirst + " for " + years + " years. " +
      "I am aware that " + defFirst + " is currently before the court in relation to the above named charge, " + caseNo + ", " +
      "and I am writing this letter voluntarily to express my support and to share my personal perspective on " + defFirst + "'s character."
    );
  }

  function syncOpeningIfNeeded() {
    if (state.openingTouched) return;
    const draft = generateOpeningDraft();
    state.opening = draft;
    openingTextarea.value = draft;
  }

  openingTextarea.addEventListener("input", () => {
    state.opening = openingTextarea.value;
    state.openingTouched = true;
    renderPreview();
    validate();
  });

  regenOpeningBtn.addEventListener("click", () => {
    state.openingTouched = false;
    syncOpeningIfNeeded();
    renderPreview();
    validate();
  });

  syncOpeningIfNeeded();

  // ---------- live preview ----------
  const paperPreview = document.getElementById("paperPreview");

  // Renders a signature image/typed-signature markup at a given pixel
  // width, or a placeholder if nothing's been signed yet. Shared by the
  // main declaration block and the footer preview below.
  function signatureMarkup(widthPx) {
    if (state.sigMode === "draw" && state.hasDrawing) {
      return `<img class="sig-img" style="max-width:${widthPx}px;" src="${canvas.toDataURL("image/png")}" alt="Signature">`;
    }
    if (state.sigMode === "type" && state.typedSig.trim()) {
      return `<span class="typed-sig-preview" style="font-size:${Math.round(widthPx / 4)}px;">${esc(state.typedSig.trim())}</span>`;
    }
    return `<span class="placeholder">not yet signed</span>`;
  }

  function renderPreview() {
    const s = state;
    let html = "";

    // --- case caption ---
    html += `<div class="stmt-caption">R v ${placeholderOr(s.defendant, "defendant's name")}</div>`;
    html += `<div class="stmt-caption-sub">${placeholderOr(s.court, "name of court")} \u2013 Case No: ${placeholderOr(s.caseNumber, "case number")}</div>`;

    // --- statement header ---
    html += `<div class="stmt-title">STATEMENT OF WITNESS</div>`;
    html += `<div class="stmt-statute">(Criminal Justice Act 1967, s.9)</div>`;
    html += `<div class="spacer"></div>`;

    html += `<div class="block">Statement of: ${placeholderOr(s.name, "your name")}</div>`;
    const addrLines = (s.address || "").split("\n").filter(l => l.trim());
    if (addrLines.length) {
      html += `<div class="block">Address: ${esc(addrLines[0])}</div>`;
      addrLines.slice(1).forEach(l => { html += `<div class="block">${esc(l)}</div>`; });
    } else {
      html += `<div class="block">Address: <span class="placeholder">your address</span></div>`;
    }
    if (s.phone.trim() || s.email.trim()) {
      const bits = [];
      if (s.phone.trim()) bits.push("Phone: " + esc(s.phone.trim()));
      if (s.email.trim()) bits.push("Email: " + esc(s.email.trim()));
      html += `<div class="block">${bits.join("&nbsp;&nbsp;&nbsp;&nbsp;")}</div>`;
    }
    html += `<div class="block">Occupation: ${placeholderOr(s.profession, "profession")}</div>`;
    html += `<div class="block">Age: Over 18</div>`;
    html += `<div class="spacer"></div>`;

    // --- declaration of truth ---
    html += `<div class="body-para">This statement, (consisting of <span class="placeholder">the number of pages shown in the footer</span> page(s) each signed by me) is true to the best of my knowledge and belief and I make it knowing that, if it is tendered in evidence, I shall be liable to prosecution if I have wilfully stated in it anything which I know to be false or do not believe to be true.</div>`;

    html += `<div class="stmt-sig-row"><span>Signed: ${signatureMarkup(130)}</span><span>Date: ${s.date ? esc(formatDateLong(s.date)) : '<span class="placeholder">date</span>'}</span></div>`;
    html += `<div class="spacer"></div>`;

    // --- subject line ---
    html += `<div class="re-line">Re: Character reference for ${placeholderOr(s.defendant, "defendant's name")}</div>`;
    html += `<div class="re-line-sub">Case No: ${placeholderOr(s.caseNumber, "case number")}\u00A0\u00A0Charge: ${placeholderOr(s.charge, "charge")}</div>`;
    html += `<div class="spacer"></div>`;

    // --- the reference content itself (no letter-style salutation/sign-off —
    // the declaration above and the signed footer below do that job here) ---
    if (s.opening.trim()) {
      html += `<div class="body-para">${esc(s.opening.trim())}</div>`;
    } else {
      html += `<div class="body-para placeholder">Your opening paragraph will appear here.</div>`;
    }

    const nonEmptyParas = s.paragraphs.filter(p => p.trim());
    if (nonEmptyParas.length) {
      nonEmptyParas.forEach(p => {
        html += `<div class="body-para">${esc(p.trim())}</div>`;
      });
    } else {
      html += `<div class="body-para placeholder">Your reference paragraphs will appear here as you write them.</div>`;
    }

    // --- representative footer (this repeats on every page of the PDF/Word download) ---
    html += `<div class="stmt-footer-preview">`;
    html += `<div class="stmt-footer-row"><span>Signed: ${signatureMarkup(70)}</span><span>Page 1 of <span class="placeholder">N</span></span></div>`;
    html += `<p class="stmt-footer-note">This footer repeats at the bottom of every page in the downloaded PDF and Word document, with the page count calculated automatically.</p>`;
    html += `</div>`;

    paperPreview.innerHTML = html;
  }

  renderPreview();

  // ---------- validation ----------
  const requiredFields = ["name", "address", "date", "relationship", "defendant", "court", "charge", "caseNumber", "profession", "yearsKnown", "opening"];
  const genStatus = document.getElementById("genStatus");
  const pdfBtn = document.getElementById("downloadPdfBtn");
  const wordBtn = document.getElementById("downloadWordBtn");

  function fieldValue(key) {
    return key === "caseNumber" ? state.caseNumber : state[key];
  }

  function validate() {
    let missing = [];
    requiredFields.forEach(key => {
      const empty = !fieldValue(key) || !fieldValue(key).trim();
      if (empty) missing.push(key);
    });

    const hasParagraph = state.paragraphs.some(p => p.trim());
    if (!hasParagraph) missing.push("at least one reference paragraph");

    const hasSignature = state.sigMode === "draw" ? state.hasDrawing : !!state.typedSig.trim();
    if (!hasSignature) missing.push("signature");

    if (missing.length === 0) {
      pdfBtn.disabled = false;
      wordBtn.disabled = false;
      genStatus.textContent = "Everything looks complete — ready to download.";
      genStatus.classList.remove("warn");
    } else {
      pdfBtn.disabled = true;
      wordBtn.disabled = true;
      genStatus.textContent = "Still needed: " + humanList(missing) + ".";
      genStatus.classList.remove("warn");
    }
    return missing;
  }

  const fieldLabels = {
    name: "your name", address: "your address", date: "the date",
    relationship: "your relationship to the defendant", defendant: "the defendant's name",
    court: "the name of the court", charge: "the charge", caseNumber: "the case number",
    profession: "your profession", yearsKnown: "how many years you've known the defendant",
    opening: "the opening paragraph"
  };
  function humanList(keys) {
    const labels = keys.map(k => fieldLabels[k] || k);
    if (labels.length === 1) return labels[0];
    return labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
  }

  validate();

  // ---------- signature image for PDF ----------
  function getSignatureImage() {
    return new Promise(resolve => {
      if (state.sigMode === "draw") {
        if (!state.hasDrawing) return resolve(null);
        const rect = canvas.getBoundingClientRect();
        resolve({ dataUrl: canvas.toDataURL("image/png"), w: rect.width, h: rect.height });
        return;
      }
      // typed mode: render to an offscreen canvas using the cursive font
      const text = state.typedSig.trim();
      if (!text) return resolve(null);
      const draw = () => {
        const fontSize = 48;
        const off = document.createElement("canvas");
        const octx = off.getContext("2d");
        octx.font = fontSize + "px 'Dancing Script'";
        const metrics = octx.measureText(text);
        const padX = 20, padY = 20;
        off.width = Math.ceil(metrics.width + padX * 2);
        off.height = Math.ceil(fontSize * 1.5 + padY);
        octx.font = fontSize + "px 'Dancing Script'";
        octx.fillStyle = "#1E2621";
        octx.textBaseline = "middle";
        octx.fillText(text, padX, off.height / 2);
        resolve({ dataUrl: off.toDataURL("image/png"), w: off.width, h: off.height });
      };
      if (document.fonts && document.fonts.load) {
        document.fonts.load("48px 'Dancing Script'").then(draw).catch(draw);
      } else {
        draw();
      }
    });
  }

  // ---------- PDF generation ----------
  // Builds a jsPDF document laid out as a Section 9 (Criminal Justice Act
  // 1967) statement of witness: case caption, statement header, the
  // declaration of truth with a signature/date row, then the reference
  // content. `pageCountLabel` is what's printed in the declaration's
  // "(consisting of N page(s) each signed by me)" — see buildPdfBlob()
  // below for how the real value is worked out. `sig` is the resolved
  // signature image (or null), passed in rather than re-fetched so both
  // passes use the exact same signature. Mirrors renderPreview() above —
  // if you change the content/order in one, change it in the other.
  const PDF_MARGIN_LEFT = 25, PDF_MARGIN_RIGHT = 25, PDF_MARGIN_TOP = 25;
  // Extra-large bottom margin so body text never runs into the footer.
  const PDF_MARGIN_BOTTOM = 34;
  const PDF_PAGE_WIDTH = 210, PDF_PAGE_HEIGHT = 297;

  function renderStatementDoc(pageCountLabel, sig) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const marginLeft = PDF_MARGIN_LEFT, marginRight = PDF_MARGIN_RIGHT;
    const marginTop = PDF_MARGIN_TOP, marginBottom = PDF_MARGIN_BOTTOM;
    const pageWidth = PDF_PAGE_WIDTH, pageHeight = PDF_PAGE_HEIGHT;
    const usableWidth = pageWidth - marginLeft - marginRight;
    const lineHeight = 6;
    let y = marginTop;

    // jsPDF ships Helvetica/Times/Courier natively. "times" is used here to
    // match the serif look of the on-screen preview. To use a genuinely
    // different typeface in the PDF you'll need to embed a .ttf as base64 —
    // see jsPDF's "Add Custom Fonts" docs.
    doc.setFont("times", "normal");
    doc.setFontSize(11);

    function checkPage(extra) {
      if (y + (extra || 0) > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
    }
    function line(text) {
      checkPage(lineHeight);
      doc.text(text, marginLeft, y);
      y += lineHeight;
    }
    function centered(text, extraHeight) {
      checkPage(lineHeight + (extraHeight || 0));
      doc.text(text, pageWidth / 2, y, { align: "center" });
      y += lineHeight;
    }
    function wrapped(text) {
      const lines = doc.splitTextToSize(text, usableWidth);
      lines.forEach(l => {
        checkPage(lineHeight);
        doc.text(l, marginLeft, y);
        y += lineHeight;
      });
    }
    function space(mm) {
      y += (mm === undefined ? lineHeight : mm);
      checkPage(0);
    }

    const s = state;

    // --- case caption ---
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    centered("R v " + s.defendant.trim());
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    centered(s.court.trim() + "\u00A0\u2013\u00A0Case No: " + s.caseNumber.trim());
    doc.setFontSize(11);
    space(6);

    // --- statement header ---
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    centered("STATEMENT OF WITNESS", 2);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    centered("(Criminal Justice Act 1967, s.9)");
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    space(6);

    line("Statement of: " + s.name.trim());
    const addrLines = (s.address || "").split("\n").filter(l => l.trim());
    if (addrLines.length) {
      line("Address: " + addrLines[0].trim());
      addrLines.slice(1).forEach(l => line(l.trim()));
    }
    if (s.phone.trim() || s.email.trim()) {
      const bits = [];
      if (s.phone.trim()) bits.push("Phone: " + s.phone.trim());
      if (s.email.trim()) bits.push("Email: " + s.email.trim());
      line(bits.join("    "));
    }
    line("Occupation: " + s.profession.trim());
    line("Age: Over 18");
    space(6);

    // --- declaration of truth ---
    wrapped(
      "This statement, (consisting of " + pageCountLabel + " page(s) each signed by me) is true to the " +
      "best of my knowledge and belief and I make it knowing that, if it is tendered in evidence, I shall " +
      "be liable to prosecution if I have wilfully stated in it anything which I know to be false or do " +
      "not believe to be true."
    );
    space(8);

    checkPage(18);
    const sigRowY = y;
    doc.text("Signed:", marginLeft, sigRowY + 5);
    if (sig) {
      const imgW = 40, imgH = Math.max(10, imgW * (sig.h / sig.w) * 0.55);
      doc.addImage(sig.dataUrl, "PNG", marginLeft + 18, sigRowY - imgH + 6, imgW, imgH);
    }
    doc.text("Date: " + formatDateLong(s.date), marginLeft + 100, sigRowY + 5);
    y = sigRowY + 14;
    space(8);

    // --- subject line ---
    doc.setFont("times", "bold");
    wrapped("Re: Character reference for " + s.defendant.trim());
    wrapped("Case No: " + s.caseNumber.trim() + "\u00A0\u00A0Charge: " + s.charge.trim());
    doc.setFont("times", "normal");
    space();

    // --- the reference content itself (no letter-style salutation/sign-off —
    // the declaration above and the signed footer below do that job here) ---
    if (s.opening.trim()) {
      s.opening.trim().split(/\n{2,}/).forEach(part => {
        const cleaned = part.trim().replace(/\s*\n\s*/g, " ");
        if (cleaned) {
          wrapped(cleaned);
          space();
        }
      });
    }

    s.paragraphs.forEach(p => {
      if (p.trim()) {
        wrapped(p.trim());
        space();
      }
    });

    return doc;
  }

  // Draws the repeated footer — signature plus "Page x of y" — on the
  // current page of `doc`. Called once per page, after the full document
  // has been laid out, so it sits on top of (never under) the body text.
  function drawPdfFooter(doc, pageNum, totalPages, sig) {
    const marginLeft = PDF_MARGIN_LEFT, marginRight = PDF_MARGIN_RIGHT;
    const pageWidth = PDF_PAGE_WIDTH, pageHeight = PDF_PAGE_HEIGHT;
    const ruleY = pageHeight - 26;
    const textY = pageHeight - 15;

    doc.setDrawColor(190);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, ruleY, pageWidth - marginRight, ruleY);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Signed:", marginLeft, textY);
    if (sig) {
      const imgW = 22, imgH = Math.max(6, imgW * (sig.h / sig.w) * 0.55);
      doc.addImage(sig.dataUrl, "PNG", marginLeft + 14, textY - imgH + 2, imgW, imgH);
    }
    doc.text("Page " + pageNum + " of " + totalPages, pageWidth - marginRight, textY, { align: "right" });
    doc.setFontSize(11);
  }

  async function buildPdfBlob() {
    const sig = await getSignatureImage();

    // Pass 1: render with a 2-character placeholder ("XX") for the page
    // count, so the declaration sentence is never shorter than the real
    // one will be — that keeps pagination identical between passes —
    // purely to find out how many pages the content actually needs.
    const dryDoc = renderStatementDoc("XX", sig);
    const totalPages = dryDoc.internal.getNumberOfPages();

    // Pass 2: render again with the real page count in the declaration,
    // then stamp the signed "Page x of y" footer onto every page.
    const finalDoc = renderStatementDoc(String(totalPages), sig);
    for (let i = 1; i <= totalPages; i++) {
      finalDoc.setPage(i);
      drawPdfFooter(finalDoc, i, totalPages, sig);
    }

    return finalDoc.output("blob");
  }

  // ---------- Word document generation ----------
  // This produces a "Word-compatible HTML" file (classic .doc, not true
  // OOXML .docx) — a trick of wrapping styled HTML in Word's own XML
  // namespaces and saving it with a .doc extension and the
  // application/msword MIME type. Word, Google Docs and LibreOffice all
  // open it directly. It's used here instead of a .docx-generating
  // library so this app has zero external dependencies for Word export —
  // if you'd rather produce a true .docx, look at the `docx` npm package
  // (github.com/dolanmiu/docx), which has a browser build.
  //
  // The repeating footer and the live page count in the declaration both
  // use Word's own PAGE/NUMPAGES field codes (the `mso-field-code` spans
  // below) — the same trick Word's own "Save as Web Page" export uses.
  // This only resolves correctly in genuine Microsoft Word, which
  // recalculates the fields when the document is opened or printed; the
  // visible fallback text inside each span is what shows up instead in
  // apps that don't understand mso-field-code, such as Google Docs or
  // LibreOffice. Mirrors renderPreview() / buildPdfBlob() — keep all
  // three in step.
  async function buildWordBlob() {
    const s = state;
    const parts = [];

    function p(text, style) {
      parts.push(`<p style="margin:0 0 4pt 0;${style || ""}">${esc(text)}</p>`);
    }
    function centeredP(text, style) {
      parts.push(`<p style="margin:0 0 4pt 0;text-align:center;${style || ""}">${esc(text)}</p>`);
    }
    function spacer() {
      parts.push(`<p style="margin:0 0 12pt 0;">&nbsp;</p>`);
    }
    function paragraphBlock(text) {
      parts.push(`<p style="margin:0 0 12pt 0;">${esc(text)}</p>`);
    }

    // --- case caption ---
    centeredP("R v " + s.defendant.trim(), "font-weight:bold;font-size:13pt;");
    centeredP(s.court.trim() + "\u00A0\u2013\u00A0Case No: " + s.caseNumber.trim(), "color:#444;font-size:10.5pt;");
    parts.push(`<p style="margin:0 0 14pt 0;">&nbsp;</p>`);

    // --- statement header ---
    centeredP("STATEMENT OF WITNESS", "font-weight:bold;font-size:15pt;letter-spacing:0.5pt;");
    centeredP("(Criminal Justice Act 1967, s.9)", "font-style:italic;font-size:9pt;color:#444;");
    spacer();

    p("Statement of: " + s.name.trim());
    const addrLines = (s.address || "").split("\n").filter(l => l.trim());
    if (addrLines.length) {
      p("Address: " + addrLines[0].trim());
      addrLines.slice(1).forEach(l => p(l.trim()));
    }
    if (s.phone.trim() || s.email.trim()) {
      const bits = [];
      if (s.phone.trim()) bits.push("Phone: " + s.phone.trim());
      if (s.email.trim()) bits.push("Email: " + s.email.trim());
      p(bits.join("    "));
    }
    p("Occupation: " + s.profession.trim());
    p("Age: Over 18");
    spacer();

    // --- declaration of truth, with a live Word field for the page count ---
    parts.push(
      `<p style="margin:0 0 10pt 0;">This statement, (consisting of ` +
      `<span style="mso-field-code:' NUMPAGES '">the number of pages shown in the footer</span>` +
      ` page(s) each signed by me) is true to the best of my knowledge and belief and I make it ` +
      `knowing that, if it is tendered in evidence, I shall be liable to prosecution if I have ` +
      `wilfully stated in it anything which I know to be false or do not believe to be true.</p>`
    );

    const sig = await getSignatureImage();
    const sigImgTag = sig ? `<img src="${sig.dataUrl}" style="height:16pt;vertical-align:middle;margin:0 8pt;">` : "";
    parts.push(
      `<p style="margin:4pt 0 14pt 0;"><strong>Signed:</strong> ${sigImgTag} ` +
      `&nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong> ${esc(formatDateLong(s.date))}</p>`
    );

    // --- subject line ---
    p("Re: Character reference for " + s.defendant.trim(), "font-weight:bold;");
    p("Case No: " + s.caseNumber.trim() + "\u00A0\u00A0Charge: " + s.charge.trim(), "font-weight:bold;");
    spacer();

    // --- the reference content itself (no letter-style salutation/sign-off —
    // the declaration above and the signed footer below do that job here) ---
    if (s.opening.trim()) {
      s.opening.trim().split(/\n{2,}/).forEach(part => {
        const cleaned = part.trim().replace(/\s*\n\s*/g, " ");
        if (cleaned) paragraphBlock(cleaned);
      });
    }

    s.paragraphs.forEach(para => {
      if (para.trim()) paragraphBlock(para.trim());
    });

    // --- repeating footer (Word-only; see comment above) ---
    const footerSigTag = sig ? `<img src="${sig.dataUrl}" style="height:12pt;vertical-align:middle;margin:0 6pt;">` : "";
    const footerHtml =
      `<div style="mso-element:footer;" id="f1">` +
      `<p class="MsoFooter" style="border-top:0.5pt solid #999999;padding-top:4pt;margin:0;">` +
      `Signed: ${footerSigTag}` +
      `<span style="float:right;">Page ` +
      `<span style="mso-field-code:' PAGE '">1</span> of ` +
      `<span style="mso-field-code:' NUMPAGES '">1</span></span>` +
      `</p></div>`;

    const preHtml =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Statement of Witness</title>" +
      "<style>" +
      "@page WordSection1 { size: 595.3pt 841.9pt; margin: 70.9pt 70.9pt 99pt 70.9pt; mso-footer-margin: 42pt; mso-footer: f1; } " +
      "div.WordSection1 { page: WordSection1; } " +
      "p.MsoFooter { margin: 0; font-size: 9pt; font-family: 'Times New Roman', serif; } " +
      "body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color:#000000; }" +
      "</style></head><body><div class='WordSection1'>";
    const postHtml = "</div>" + footerHtml + "</body></html>";

    const fullHtml = preHtml + parts.join("") + postHtml;
    return new Blob(["\ufeff", fullHtml], { type: "application/msword" });
  }

  // Plain browser download — works on GitHub Pages and any static host.
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function handleDownload(format, button) {
    const missing = validate();
    if (missing.length) return;

    pdfBtn.disabled = true;
    wordBtn.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = format === "pdf" ? "Preparing PDF…" : "Preparing Word…";

    try {
      const defendantName = state.defendant.trim() || "defendant";
      let blob, filename;
      if (format === "pdf") {
        blob = await buildPdfBlob();
        filename = "Character Reference - " + defendantName + ".pdf";
      } else {
        blob = await buildWordBlob();
        filename = "Character Reference - " + defendantName + ".doc";
      }
      downloadBlob(blob, filename);
      genStatus.textContent = "Downloading…";
    } catch (err) {
      console.error(err);
      genStatus.textContent = "Something went wrong generating the file. Please try again.";
      genStatus.classList.add("warn");
    } finally {
      button.textContent = originalLabel;
      validate(); // restores the correct enabled/disabled state for both buttons
    }
  }

  pdfBtn.addEventListener("click", () => handleDownload("pdf", pdfBtn));
  wordBtn.addEventListener("click", () => handleDownload("word", wordBtn));

})();
