// Link que abre o WhatsApp (aplicativo ou WhatsApp Web) com a mensagem já escrita.
// Sem número, o próprio WhatsApp pede para escolher o contato.
export function linkWhatsApp(contato, texto) {
  const numero = String(contato || "").replace(/\D/g, "");
  if (contato && numero.length < 8) return null;
  return `https://wa.me/${numero.length >= 8 ? numero : ""}?text=${encodeURIComponent(texto)}`;
}
