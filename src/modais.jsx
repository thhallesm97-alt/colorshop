import React, { useState, useRef } from "react";
import { Plus, Trash2, Download, Upload, Cloud, LogOut, Loader2, Monitor } from "lucide-react";
import { useApp, CAIXA_META, PAGAMENTOS } from "./contexto.js";
import { fmtUSD, fmtDate, fmtHora, todayISO, uid, normalizar } from "./lib/format.js";
import * as db from "./lib/db.js";
import { Modal, Field, inputCls, btnPrimario, btnSecundario, Segmentado } from "./ui.jsx";
import { CambioForm } from "./paginas.jsx";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function Erro({ children }) {
  if (!children) return null;
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>;
}

function SelectCaixa({ value, onChange }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(CAIXA_META).map((k) => <option key={k} value={k}>{CAIXA_META[k].label}</option>)}
    </select>
  );
}

export function VendaModal() {
  const { clientes, estoque, registrarVenda, fecharModal } = useApp();
  const disponiveis = estoque.filter((i) => i.qtd > 0);
  const [clienteId, setClienteId] = useState("");
  const [itemId, setItemId] = useState(disponiveis[0]?.id || "");
  const [qtd, setQtd] = useState(1);
  const [tipoVenda, setTipoVenda] = useState("Varejo");
  const [pagamento, setPagamento] = useState("PIX");
  const [condicao, setCondicao] = useState("À vista");
  const [carrinho, setCarrinho] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState(null);

  const termo = normalizar(filtro);
  const opcoes = disponiveis.filter((i) => !termo || normalizar(i.nome).includes(termo));
  const item = estoque.find((i) => i.id === itemId);
  const jaNoCarrinho = carrinho.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qtd, 0);
  const disponivel = item ? item.qtd - jaNoCarrinho : 0;
  const precoUnit = item ? (tipoVenda === "Atacado" ? item.atacado : item.varejo) : 0;
  const total = carrinho.reduce((s, l) => s + l.precoUnit * l.qtd, 0);
  const podeAdicionar = item && qtd >= 1 && Number.isInteger(qtd) && qtd <= disponivel;

  function addAoCarrinho() {
    if (!podeAdicionar) return;
    setCarrinho((c) => [...c, { key: uid(), itemId, nome: item.nome, qtd, tipoVenda, precoUnit }]);
    setQtd(1);
    setErro(null);
  }
  function finalizar() {
    const e = registrarVenda({
      clienteId,
      itens: carrinho.map((l) => ({ itemId: l.itemId, qtd: l.qtd, tipoVenda: l.tipoVenda })),
      pagamento,
      condicao,
    });
    if (e) setErro(e);
    else fecharModal();
  }

  return (
    <Modal title="Nova venda" onClose={fecharModal} wide>
      <Erro>{erro}</Erro>
      <Field label="Cliente">
        <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Consumidor (sem cadastro)</option>
          {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Field>

      <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
        <div className="text-xs font-semibold text-slate-600 mb-3">Adicionar produto</div>
        {disponiveis.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum produto com estoque disponível. Registre uma compra primeiro.</div>
        ) : (
          <>
            <Field label="Produto">
              <input className={inputCls + " mb-2"} placeholder="Filtrar produtos..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <select
                className={inputCls}
                value={opcoes.some((o) => o.id === itemId) ? itemId : ""}
                onChange={(e) => { setItemId(e.target.value); setQtd(1); }}
              >
                {!opcoes.some((o) => o.id === itemId) && <option value="">Selecione...</option>}
                {opcoes.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.qtd} disp.)</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Tipo de venda">
                <Segmentado valor={tipoVenda} onChange={setTipoVenda} opcoes={[{ valor: "Varejo", label: "Varejo" }, { valor: "Atacado", label: "Atacado" }]} />
              </Field>
              <Field label={`Quantidade (${Math.max(0, disponivel)} disp.)`}>
                <input type="number" min="1" step="1" max={disponivel} className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
              </Field>
              <Field label="Valor unitário">
                <input type="text" disabled className={inputCls} value={item ? fmtUSD(precoUnit) : ""} />
              </Field>
            </div>
            <button type="button" onClick={addAoCarrinho} disabled={!podeAdicionar} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
              <Plus size={14} /> Adicionar à venda
            </button>
          </>
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-600 mb-2">Itens da venda ({carrinho.length})</div>
        {carrinho.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">Nenhum produto adicionado ainda.</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {carrinho.map((l) => (
              <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{l.nome} × {l.qtd}</div>
                  <div className="text-xs text-slate-400">{l.tipoVenda} · {fmtUSD(l.precoUnit)} un.</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{fmtUSD(l.precoUnit * l.qtd)}</span>
                  <button onClick={() => setCarrinho((c) => c.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pagamento">
          <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
            {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Condição">
          <select className={inputCls} value={condicao} onChange={(e) => setCondicao(e.target.value)}>
            <option>À vista</option>
            <option>A prazo</option>
          </select>
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">Total da venda</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(total)}</span>
      </div>
      <button onClick={finalizar} disabled={carrinho.length === 0} className={btnPrimario + " w-full"}>
        Finalizar venda
      </button>
    </Modal>
  );
}

export function CompraModal() {
  const { fornecedores, estoque, registrarCompra, fecharModal } = useApp();
  const [fornecedorId, setFornecedorId] = useState(fornecedores[0]?.id || "");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState(1);
  const [custo, setCusto] = useState(0);
  const [varejo, setVarejo] = useState(0);
  const [atacado, setAtacado] = useState(0);
  const [pagamento, setPagamento] = useState("PIX");
  const [carrinho, setCarrinho] = useState([]);

  const nomeTrim = nome.trim();
  const existente = nomeTrim ? estoque.find((i) => normalizar(i.nome) === normalizar(nomeTrim)) : null;
  const isNovoProduto = nomeTrim !== "" && !existente;
  const podeAdicionar = nomeTrim !== "" && qtd > 0 && custo > 0 && (!isNovoProduto || (varejo > 0 && atacado > 0));
  const total = carrinho.reduce((s, l) => s + l.custo * l.qtd, 0);

  function addAoCarrinho() {
    if (!podeAdicionar) return;
    setCarrinho((c) => [...c, { key: uid(), nome: existente ? existente.nome : nomeTrim, qtd, custo, varejo, atacado }]);
    setNome(""); setQtd(1); setCusto(0); setVarejo(0); setAtacado(0);
  }
  function finalizar() {
    if (carrinho.length === 0) return;
    registrarCompra({ fornecedorId, itens: carrinho, pagamento });
    fecharModal();
  }

  return (
    <Modal title="Nova compra (entrada no estoque)" onClose={fecharModal} wide>
      <Field label="Fornecedor">
        <select className={inputCls} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Sem cadastro</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </Field>

      <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
        <div className="text-xs font-semibold text-slate-600 mb-3">Adicionar produto</div>
        <Field label="Produto" hint={existente ? `Produto já cadastrado · ${existente.qtd} em estoque` : nomeTrim ? "Produto novo: será cadastrado no estoque" : null}>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto (novo ou existente)" list="lista-produtos" />
          <datalist id="lista-produtos">
            {estoque.map((i) => <option key={i.id} value={i.nome} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade">
            <input type="number" min="1" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
          </Field>
          <Field label="Custo unitário (US$)">
            <input type="number" step="0.01" min="0" className={inputCls} value={custo} onChange={(e) => setCusto(n(e.target.value))} />
          </Field>
        </div>
        {isNovoProduto && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço varejo (US$) *">
              <input type="number" step="0.01" min="0" className={inputCls} value={varejo} onChange={(e) => setVarejo(n(e.target.value))} />
            </Field>
            <Field label="Preço atacado (US$) *">
              <input type="number" step="0.01" min="0" className={inputCls} value={atacado} onChange={(e) => setAtacado(n(e.target.value))} />
            </Field>
          </div>
        )}
        <button type="button" onClick={addAoCarrinho} disabled={!podeAdicionar} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
          <Plus size={14} /> Adicionar à compra
        </button>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-600 mb-2">Itens da compra ({carrinho.length})</div>
        {carrinho.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">Nenhum produto adicionado ainda.</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {carrinho.map((l) => (
              <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{l.nome} × {l.qtd}</div>
                  <div className="text-xs text-slate-400">Custo {fmtUSD(l.custo)} un.</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{fmtUSD(l.custo * l.qtd)}</span>
                  <button onClick={() => setCarrinho((c) => c.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Pago com">
        <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
          {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">Total da compra</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(total)}</span>
      </div>
      <button onClick={finalizar} disabled={carrinho.length === 0} className={btnPrimario + " w-full"}>
        Finalizar compra
      </button>
    </Modal>
  );
}

export function MovimentoModal() {
  const { addMovimento, fecharModal } = useApp();
  const [caixaKey, setCaixaKey] = useState("pix");
  const [tipo, setTipo] = useState("Entrada");
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  return (
    <Modal title="Novo movimento de caixa" onClose={fecharModal}>
      <Field label="Caixa"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option>Entrada</option>
            <option>Saída</option>
          </select>
        </Field>
        <Field label="Valor">
          <input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(n(e.target.value))} />
        </Field>
      </div>
      <Field label="Descrição">
        <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Troco inicial, retirada, depósito" />
      </Field>
      <button
        onClick={() => { addMovimento(caixaKey, tipo, valor, descricao.trim() || "Movimento manual"); fecharModal(); }}
        disabled={!(valor > 0)}
        className={btnPrimario + " w-full"}
      >
        Registrar movimento
      </button>
    </Modal>
  );
}

export function ItemModal() {
  const { editando, estoque, salvarItem, excluirItem, fecharModal } = useApp();
  const isEdit = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [qtd, setQtd] = useState(editando?.qtd ?? 0);
  const [custo, setCusto] = useState(editando?.custo ?? 0);
  const [varejo, setVarejo] = useState(editando?.varejo ?? 0);
  const [atacado, setAtacado] = useState(editando?.atacado ?? 0);
  const [min, setMin] = useState(editando?.min ?? 3);

  const nomeTrim = nome.trim();
  const duplicado = estoque.some((i) => i.id !== editando?.id && normalizar(i.nome) === normalizar(nomeTrim));
  const invalid = !nomeTrim || duplicado || !(varejo > 0) || !(atacado > 0) || qtd < 0 || min < 0;

  function save() {
    if (invalid) return;
    salvarItem({ nome: nomeTrim, qtd, custo, varejo, atacado, min }, editando);
    fecharModal();
  }

  return (
    <Modal title={isEdit ? "Editar produto" : "Novo produto"} onClose={fecharModal}>
      <Field label="Nome do produto">
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        {duplicado && <div className="text-xs text-red-600 mt-1">Já existe um produto com esse nome.</div>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade em estoque" hint={isEdit ? "Altere só se contou o estoque." : null}>
          <input type="number" min="0" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
        </Field>
        <Field label="Estoque mínimo" hint="Avisa quando chegar nesse número.">
          <input type="number" min="0" step="1" className={inputCls} value={min} onChange={(e) => setMin(Math.floor(n(e.target.value)))} />
        </Field>
      </div>
      <Field label="Custo unitário (US$)">
        <input type="number" step="0.01" min="0" className={inputCls} value={custo} onChange={(e) => setCusto(n(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço varejo (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={varejo} onChange={(e) => setVarejo(n(e.target.value))} />
        </Field>
        <Field label="Preço atacado (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={atacado} onChange={(e) => setAtacado(n(e.target.value))} />
        </Field>
      </div>
      {varejo > 0 && custo > 0 && (
        <div className="text-xs text-slate-500 -mt-2 mb-4">
          Margem no varejo: {Math.round(((varejo - custo) / varejo) * 100)}% · no atacado: {atacado > 0 ? Math.round(((atacado - custo) / atacado) * 100) : 0}%
        </div>
      )}
      {isEdit && (
        <button onClick={() => excluirItem(editando) && fecharModal()} className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">
          Excluir produto
        </button>
      )}
      <button onClick={save} disabled={invalid} className={btnPrimario + " w-full"}>
        {isEdit ? "Salvar alterações" : "Cadastrar produto"}
      </button>
    </Modal>
  );
}

const CATEGORIAS = ["Água", "Energia", "Internet", "Aluguel", "Salários", "Impostos", "Fornecedor", "Outro"];

export function ContaModal() {
  const { editando, salvarConta, excluirConta, fecharModal } = useApp();
  const isEdit = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [categoria, setCategoria] = useState(editando?.categoria || "Água");
  const [valor, setValor] = useState(editando?.valor ?? 0);
  const [vencimento, setVencimento] = useState(editando?.vencimento || todayISO());
  const valido = nome.trim() && valor > 0 && vencimento;

  return (
    <Modal title={isEdit ? "Editar conta" : "Nova conta a pagar"} onClose={fecharModal}>
      <Field label="Categoria">
        <select className={inputCls} value={categoria} onChange={(e) => { setCategoria(e.target.value); if (!isEdit && !nome) setNome(e.target.value); }}>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Nome da conta"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Energia - Farmácia" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (US$)"><input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(n(e.target.value))} /></Field>
        <Field label="Vencimento"><input type="date" className={inputCls} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
      </div>
      {isEdit && (
        <button onClick={() => excluirConta(editando) && fecharModal()} className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">
          Excluir conta
        </button>
      )}
      <button
        onClick={() => { salvarConta({ nome: nome.trim(), categoria, valor, vencimento }, editando); fecharModal(); }}
        disabled={!valido}
        className={btnPrimario + " w-full"}
      >
        {isEdit ? "Salvar alterações" : "Adicionar conta"}
      </button>
    </Modal>
  );
}

export function PagarContaModal() {
  const { editando: conta, pagarConta, fecharModal } = useApp();
  const [caixaKey, setCaixaKey] = useState("pix");
  if (!conta) return null;
  return (
    <Modal title={`Pagar: ${conta.nome}`} onClose={fecharModal}>
      <div className="text-sm text-slate-600 mb-4">
        Valor: <span className="font-semibold text-slate-900">{fmtUSD(conta.valor)}</span> · Vencimento: {fmtDate(conta.vencimento)}
      </div>
      <Field label="Pagar com"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      <button onClick={() => { pagarConta(conta.id, caixaKey); fecharModal(); }} className={btnPrimario + " w-full"}>
        Confirmar pagamento
      </button>
    </Modal>
  );
}

export function ReceberVendaModal() {
  const { editando: venda, marcarVendaPaga, fecharModal } = useApp();
  const [caixaKey, setCaixaKey] = useState("pix");
  if (!venda) return null;
  return (
    <Modal title={`Receber venda #${venda.numero}`} onClose={fecharModal}>
      <div className="text-sm text-slate-600 mb-4">
        Cliente: <span className="font-medium text-slate-900">{venda.clienteNome}</span> · Valor: <span className="font-semibold text-slate-900">{fmtUSD(venda.valor)}</span>
      </div>
      <Field label="Recebido em"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      <button onClick={() => { marcarVendaPaga(venda.id, caixaKey); fecharModal(); }} className={btnPrimario + " w-full"}>
        Confirmar recebimento
      </button>
    </Modal>
  );
}

export function PessoaModal({ tipo }) {
  const { editando, salvarPessoa, fecharModal } = useApp();
  const isCliente = tipo === "cliente";
  const [nome, setNome] = useState(editando?.nome || "");
  const [contato, setContato] = useState(editando?.contato || "");
  const [obs, setObs] = useState(editando?.obs || "");
  const titulo = (editando ? "Editar " : "Novo ") + (isCliente ? "cliente" : "fornecedor");
  return (
    <Modal title={titulo} onClose={fecharModal}>
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp / telefone" hint="Com código do país, ex.: +595 981 234 567. Usado para enviar mensagens pelo WhatsApp.">
        <input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="+595 981 234 567" />
      </Field>
      <Field label="Observação"><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>
      <button
        onClick={() => { salvarPessoa(tipo, { nome: nome.trim(), contato: contato.trim(), obs: obs.trim() }, editando); fecharModal(); }}
        disabled={!nome.trim()}
        className={btnPrimario + " w-full"}
      >
        Salvar
      </button>
    </Modal>
  );
}

export function CambioModal() {
  const { cambio, setCambio, fecharModal } = useApp();
  return (
    <Modal title="Ajustar câmbio" onClose={fecharModal}>
      <CambioForm initial={cambio} onSave={(v) => { setCambio({ ...cambio, ...v }); fecharModal(); }} />
    </Modal>
  );
}

// Sincronização entre computadores, backup e instalação.
export function DadosModal() {
  const { sync, baixarBackup, restaurarBackup, fecharModal, instalar, setInstalar } = useApp();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const arquivo = useRef(null);

  async function entrar(e) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      await db.entrar(email.trim(), senha);
      setSenha("");
      setMsg("Pronto, este computador agora sincroniza com a nuvem.");
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar(ev) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    if (!window.confirm("Importar este backup? Os registros do arquivo serão juntados aos dados atuais (registros iguais serão substituídos pela versão do arquivo).")) return;
    setOcupado(true); setErro(null); setMsg(null);
    try {
      const qtd = await restaurarBackup(f);
      setMsg(`Backup importado: ${qtd} registros.`);
    } catch (err) {
      setErro(err.message || "Não foi possível importar o arquivo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal title="Dados, sincronização e backup" onClose={fecharModal}>
      <Erro>{erro}</Erro>
      {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}

      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-900 mb-1">Sincronização entre computadores</div>
        {!sync.configurado ? (
          <p className="text-sm text-slate-500">
            Os dados estão salvos só neste computador. A sincronização com a nuvem ainda não foi configurada neste sistema.
          </p>
        ) : sync.logado ? (
          <div className="text-sm text-slate-600 space-y-2">
            <p>Conectado como <span className="font-medium text-slate-900">{sync.email}</span>.</p>
            <p>
              {!sync.online
                ? "Sem internet agora. Continue usando normalmente: tudo fica salvo aqui e é enviado quando a internet voltar."
                : sync.erro
                ? `Erro na última tentativa: ${sync.erro}`
                : sync.ultimaSync
                ? `Última sincronização às ${fmtHora(sync.ultimaSync)}.`
                : "Sincronizando..."}
              {sync.pendentes > 0 && ` ${sync.pendentes} alterações aguardando envio.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => db.sincronizar()} disabled={!sync.online || sync.sincronizando} className={btnSecundario}>
                {sync.sincronizando ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />} Sincronizar agora
              </button>
              <button
                onClick={() => window.confirm("Sair da conta neste computador? Os dados continuam salvos aqui, mas deixam de sincronizar.") && db.sair()}
                className={btnSecundario}
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={entrar}>
            <p className="text-sm text-slate-500 mb-3">Entre com a conta da farmácia para este computador enviar e receber os dados da nuvem.</p>
            <Field label="E-mail"><input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
            <Field label="Senha"><input type="password" required className={inputCls} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></Field>
            <button type="submit" disabled={ocupado || !sync.online} className={btnPrimario + " w-full"}>
              {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} {sync.online ? "Entrar" : "Sem internet"}
            </button>
          </form>
        )}
      </div>

      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-900 mb-1">Backup</div>
        <p className="text-sm text-slate-500 mb-3">Baixe uma cópia de todos os dados para guardar no computador ou em um pendrive.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={baixarBackup} className={btnSecundario}><Download size={14} /> Baixar backup</button>
          <button onClick={() => arquivo.current?.click()} disabled={ocupado} className={btnSecundario}><Upload size={14} /> Restaurar backup</button>
          <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={restaurar} />
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-900 mb-1">Usar como aplicativo</div>
        <p className="text-sm text-slate-500 mb-3">
          Instale o Indufarma neste computador para abrir pelo ícone na área de trabalho, mesmo sem internet.
          {!instalar && " Se o botão não aparecer, use o menu do Chrome ou Edge: “Instalar Indufarma”."}
        </p>
        {instalar && (
          <button
            onClick={async () => { instalar.prompt(); await instalar.userChoice; setInstalar(null); }}
            className={btnSecundario}
          >
            <Monitor size={14} /> Instalar no computador
          </button>
        )}
      </div>
    </Modal>
  );
}
