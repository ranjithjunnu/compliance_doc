const tok = location.pathname.split('/').pop(), box = document.getElementById('content');
const say = (title, text) => { box.textContent = ''; const h = document.createElement('h1'); h.textContent = title; const p = document.createElement('p'); p.textContent = text; box.append(h, p); };
fetch(`/api/submit/${tok}`).then(async (r) => {
  const d = await r.json();
  if (!r.ok) return say('Link unavailable', d.error);
  box.textContent = '';
  const h = document.createElement('h1'); h.textContent = `Hi ${d.first_name}`;
  const p = document.createElement('p'); p.textContent = `Please upload your ${d.document}. Due ${d.due}.`;
  const f = document.createElement('form');
  const label = document.createElement('label'); label.textContent = 'Choose a file (PDF, image or text, up to 10 MB)'; label.className = 'form-label'; label.htmlFor = 'file';
  const i = document.createElement('input'); i.type = 'file'; i.id = 'file'; i.required = true; i.className = 'form-select';
  const b = document.createElement('button'); b.className = 'btn-submit-green submit-btn'; b.textContent = 'Upload securely';
  const n = document.createElement('p'); n.className = 'subtext'; n.textContent = 'This link is unique to this request. Do not forward it.';
  f.append(label, i, b, n); box.append(h, p, f);
  f.addEventListener('submit', (e) => {
    e.preventDefault(); b.disabled = true; b.textContent = 'Uploading...';
    const rd = new FileReader();
    rd.onload = async () => {
      const res = await fetch(`/api/submit/${tok}`, { method: 'POST', body: JSON.stringify({ file: { name: i.files[0].name, mime: i.files[0].type, data: rd.result.split(',')[1] } }) });
      const o = await res.json();
      if (res.ok) say('Thank you', o.status); else { say('Upload failed', o.error); }
    };
    rd.readAsDataURL(i.files[0]);
  });
});
