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
    name: "",
    address: "",
    phone: "",
    email: "",
    date: "",
    relationship: "",
    defendant: "",
    court: "",
    charge: "",
    caseNumber: "",
    profession: "",
    yearsKnown: "",
    opening: "",
    openingTouched: false,
    paragraphs: [""],
    sigMode: "draw",
    typedSig: "",
    hasDrawing: false,
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  document.getElementById("f-date").value = todayISO;
  state.date = todayISO;

  // ---------- simple field bindings ----------
  const simpleFields = [
    "name",
    "address",
    "phone",
    "email",
    "date",
    "relationship",
    "defendant",
    "court",
    "charge",
    "profession",
    "yearsKnown",
  ];
  simpleFields.forEach((key) => {
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
      ta.placeholder =
        i === 0
          ? "Describe the defendants character from your perspective"
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
  let drawing = false,
    lastX = 0,
    lastY = 0;

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
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    lastX = p.x;
    lastY = p.y;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    state.hasDrawing = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
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
  document.querySelectorAll(".sig-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".sig-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".sig-pane")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      state.sigMode = tab.dataset.mode;
      document
        .querySelector('.sig-pane[data-pane="' + state.sigMode + '"]')
        .classList.add("active");
      renderPreview();
      validate();
    });
  });

  // ---------- helpers ----------
  function esc(str) {
    return (str || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function formatDateLong(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function placeholderOr(val, ph) {
    return val && val.trim()
      ? esc(val)
      : '<span class="placeholder">' + esc(ph) + "</span>";
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
      "My name is " +
      refFirst +
      ", I am a " +
      profession +
      " and " +
      defFull +
      "'s " +
      relationship +
      ". " +
      "I have known " +
      defFirst +
      " for " +
      years +
      " years. " +
      "I am aware that " +
      defFirst +
      " is currently before the court in relation to the above named charge, case number " +
      caseNo +
      ", " +
      "and I am writing this letter voluntarily to express my support and to share my personal perspective on " +
      defFirst +
      "'s character."
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

  function renderPreview() {
    const s = state;
    let html = "";

    html += `<div class="block">${placeholderOr(s.name, "Your name")}</div>`;
    const addrLines = (s.address || "").split("\n").filter((l) => l.trim());
    if (addrLines.length) {
      addrLines.forEach((l) => {
        html += `<div class="block">${esc(l)}</div>`;
      });
    } else {
      html += `<div class="block"><span class="placeholder">Your address</span></div>`;
    }
    if (s.phone.trim()) html += `<div class="block">${esc(s.phone)}</div>`;
    if (s.email.trim()) html += `<div class="block">${esc(s.email)}</div>`;

    html += `<div class="spacer"></div>`;
    html += `<div class="block">${s.date ? esc(formatDateLong(s.date)) : '<span class="placeholder">Date</span>'}</div>`;

    html += `<div class="spacer"></div>`;
    html += `<div class="block">The Presiding Judge</div>`;
    html += `<div class="block">${placeholderOr(s.court, "Name of court")}</div>`;

    html += `<div class="spacer"></div>`;
    html += `<div class="re-line">Re: Character reference for ${placeholderOr(s.defendant, "defendant's name")}</div>`;
    html += `<div class="re-line-sub">Case No: ${placeholderOr(s.caseNumber, "case number")}\u00A0\u00A0Charge: ${placeholderOr(s.charge, "charge")}</div>`;

    html += `<div class="block">Your Honour,</div>`;
    html += `<div class="spacer"></div>`;

    if (s.opening.trim()) {
      html += `<div class="body-para">${esc(s.opening.trim())}</div>`;
    } else {
      html += `<div class="body-para placeholder">Your opening paragraph will appear here.</div>`;
    }

    const nonEmptyParas = s.paragraphs.filter((p) => p.trim());
    if (nonEmptyParas.length) {
      nonEmptyParas.forEach((p) => {
        html += `<div class="body-para">${esc(p.trim())}</div>`;
      });
    } else {
      html += `<div class="body-para placeholder">Your reference paragraphs will appear here as you write them.</div>`;
    }

    html += `<div class="block">Yours faithfully,</div>`;
    html += `<div class="spacer"></div>`;

    if (s.sigMode === "draw" && s.hasDrawing) {
      const dataUrl = canvas.toDataURL("image/png");
      html += `<img class="sig-img" src="${dataUrl}" alt="Signature">`;
    } else if (s.sigMode === "type" && s.typedSig.trim()) {
      html += `<div class="typed-sig-preview">${esc(s.typedSig.trim())}</div>`;
    } else {
      html += `<div class="block placeholder">Your signature will appear here</div>`;
    }

    html += `<div class="block">${placeholderOr(s.name, "Your name")}</div>`;

    paperPreview.innerHTML = html;
  }

  renderPreview();

  // ---------- validation ----------
  const requiredFields = [
    "name",
    "address",
    "date",
    "relationship",
    "defendant",
    "court",
    "charge",
    "caseNumber",
    "profession",
    "yearsKnown",
    "opening",
  ];
  const genStatus = document.getElementById("genStatus");
  const pdfBtn = document.getElementById("downloadPdfBtn");
  const wordBtn = document.getElementById("downloadWordBtn");

  function fieldValue(key) {
    return key === "caseNumber" ? state.caseNumber : state[key];
  }

  function validate() {
    let missing = [];
    requiredFields.forEach((key) => {
      const empty = !fieldValue(key) || !fieldValue(key).trim();
      if (empty) missing.push(key);
    });

    const hasParagraph = state.paragraphs.some((p) => p.trim());
    if (!hasParagraph) missing.push("at least one reference paragraph");

    const hasSignature =
      state.sigMode === "draw" ? state.hasDrawing : !!state.typedSig.trim();
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
    name: "your name",
    address: "your address",
    date: "the date",
    relationship: "your relationship to the defendant",
    defendant: "the defendant's name",
    court: "the name of the court",
    charge: "the charge",
    caseNumber: "the case number",
    profession: "your profession",
    yearsKnown: "how many years you've known the defendant",
    opening: "the opening paragraph",
  };
  function humanList(keys) {
    const labels = keys.map((k) => fieldLabels[k] || k);
    if (labels.length === 1) return labels[0];
    return labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
  }

  validate();

  // ---------- signature image for PDF ----------
  function getSignatureImage() {
    return new Promise((resolve) => {
      if (state.sigMode === "draw") {
        if (!state.hasDrawing) return resolve(null);
        const rect = canvas.getBoundingClientRect();
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          w: rect.width,
          h: rect.height,
        });
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
        const padX = 20,
          padY = 20;
        off.width = Math.ceil(metrics.width + padX * 2);
        off.height = Math.ceil(fontSize * 1.5 + padY);
        octx.font = fontSize + "px 'Dancing Script'";
        octx.fillStyle = "#1E2621";
        octx.textBaseline = "middle";
        octx.fillText(text, padX, off.height / 2);
        resolve({
          dataUrl: off.toDataURL("image/png"),
          w: off.width,
          h: off.height,
        });
      };
      if (document.fonts && document.fonts.load) {
        document.fonts.load("48px 'Dancing Script'").then(draw).catch(draw);
      } else {
        draw();
      }
    });
  }

  // ---------- PDF generation ----------
  // Mirrors renderPreview() above — if you change the letter's wording or
  // order in one, change it in the other so the preview matches the PDF.
  async function buildPdfBlob() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const marginLeft = 25,
      marginRight = 25,
      marginTop = 25,
      marginBottom = 25;
    const pageWidth = 210,
      pageHeight = 297;
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
    function wrapped(text) {
      const lines = doc.splitTextToSize(text, usableWidth);
      lines.forEach((l) => {
        checkPage(lineHeight);
        doc.text(l, marginLeft, y);
        y += lineHeight;
      });
    }
    function space(mm) {
      y += mm === undefined ? lineHeight : mm;
      checkPage(0);
    }

    const s = state;
    line(s.name.trim());
    (s.address || "").split("\n").forEach((l) => {
      if (l.trim()) line(l.trim());
    });
    if (s.phone.trim()) line(s.phone.trim());
    if (s.email.trim()) line(s.email.trim());
    space();
    line(formatDateLong(s.date));
    space();
    line("The Presiding Judge");
    line(s.court.trim());
    space();

    doc.setFont("times", "bold");
    wrapped("Re: Character reference for " + s.defendant.trim());
    wrapped(
      "Case No: " +
        s.caseNumber.trim() +
        "\u00A0\u00A0Charge: " +
        s.charge.trim(),
    );
    doc.setFont("times", "normal");
    space();

    line("Your Honour,");
    space();

    if (s.opening.trim()) {
      s.opening
        .trim()
        .split(/\n{2,}/)
        .forEach((part) => {
          const cleaned = part.trim().replace(/\s*\n\s*/g, " ");
          if (cleaned) {
            wrapped(cleaned);
            space();
          }
        });
    }

    s.paragraphs.forEach((p) => {
      if (p.trim()) {
        wrapped(p.trim());
        space();
      }
    });

    line("Yours faithfully,");
    space(16);

    const sig = await getSignatureImage();
    if (sig) {
      const targetWidthMm = 50;
      const targetHeightMm = Math.max(
        10,
        targetWidthMm * (sig.h / sig.w) * 0.55,
      );
      checkPage(targetHeightMm + 2);
      doc.addImage(
        sig.dataUrl,
        "PNG",
        marginLeft,
        y - 4,
        targetWidthMm,
        targetHeightMm,
      );
      y += targetHeightMm + 4;
    }

    line(s.name.trim());

    return doc.output("blob");
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
  // Mirrors renderPreview() / buildPdfBlob() — keep all three in step.
  async function buildWordBlob() {
    const s = state;
    const parts = [];

    function p(text, style) {
      parts.push(`<p style="margin:0 0 4pt 0;${style || ""}">${esc(text)}</p>`);
    }
    function spacer() {
      parts.push(`<p style="margin:0 0 12pt 0;">&nbsp;</p>`);
    }
    function paragraphBlock(text) {
      parts.push(`<p style="margin:0 0 12pt 0;">${esc(text)}</p>`);
    }

    p(s.name.trim());
    (s.address || "").split("\n").forEach((l) => {
      if (l.trim()) p(l.trim());
    });
    if (s.phone.trim()) p(s.phone.trim());
    if (s.email.trim()) p(s.email.trim());
    spacer();
    p(formatDateLong(s.date));
    spacer();
    p("The Presiding Judge");
    p(s.court.trim());
    spacer();
    p("Re: Character reference for " + s.defendant.trim(), "font-weight:bold;");
    p(
      "Case No: " +
        s.caseNumber.trim() +
        "\u00A0\u00A0Charge: " +
        s.charge.trim(),
      "font-weight:bold;",
    );
    spacer();
    p("Your Honour,");
    spacer();

    if (s.opening.trim()) {
      s.opening
        .trim()
        .split(/\n{2,}/)
        .forEach((part) => {
          const cleaned = part.trim().replace(/\s*\n\s*/g, " ");
          if (cleaned) paragraphBlock(cleaned);
        });
    }

    s.paragraphs.forEach((para) => {
      if (para.trim()) paragraphBlock(para.trim());
    });

    p("Yours faithfully,");
    spacer();

    const sig = await getSignatureImage();
    if (sig) {
      parts.push(
        `<p style="margin:4pt 0 2pt 0;"><img src="${sig.dataUrl}" style="width:150px;" alt="Signature"></p>`,
      );
    } else {
      spacer();
    }
    p(s.name.trim());

    const preHtml =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Character Reference</title>" +
      "<style>" +
      "@page WordSection1 { size: 595.3pt 841.9pt; margin: 70.9pt 70.9pt 70.9pt 70.9pt; } " +
      "div.WordSection1 { page: WordSection1; } " +
      "body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color:#000000; }" +
      "</style></head><body><div class='WordSection1'>";
    const postHtml = "</div></body></html>";

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
    button.textContent =
      format === "pdf" ? "Preparing PDF…" : "Preparing Word…";

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
      genStatus.textContent =
        "Something went wrong generating the file. Please try again.";
      genStatus.classList.add("warn");
    } finally {
      button.textContent = originalLabel;
      validate(); // restores the correct enabled/disabled state for both buttons
    }
  }

  pdfBtn.addEventListener("click", () => handleDownload("pdf", pdfBtn));
  wordBtn.addEventListener("click", () => handleDownload("word", wordBtn));
})();
