import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { estadoFilial } from './estado';
import './style.css';

type Dados = { cpu: number; memoria: number; disco: number; latencia: number; servicos: Record<string, boolean> };
type Filial = { id: string; nome: string; recebido_em: string | null; dados: Dados | null; ativos: string[] };
type Incidente = { id: number; tipo: string; aberto_em: string; fechado_em: string | null };
type Detalhe = Filial & { incidentes: Incidente[] };
type Disponibilidade = { percentual: number | null };
const data = (s: string | null) => s ? new Date(s).toLocaleString('pt-BR') : 'Sem batimento';
const rotulos = {normal:'Normal', alerta:'Alerta', offline:'Fora do ar', aguardando:'Aguardando dados'};
async function buscar<T>(url: string, signal?: AbortSignal): Promise<T> {
  const resposta = await fetch(url, { signal });
  if (!resposta.ok) throw new Error('Falha na consulta');
  return resposta.json() as Promise<T>;
}
function App() {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const sequencia = useRef(0);
  const atualizar = useCallback(async () => {
    const atual = ++sequencia.current;
    try {
      const lista = await buscar<Filial[]>('/api/filiais');
      if (atual === sequencia.current) { setFiliais(lista); setCarregado(true); setErro(''); }
    } catch { if (atual === sequencia.current) setErro('Não foi possível consultar as filiais.'); }
  }, []);
  useEffect(() => {
    void atualizar();
    const eventos = new EventSource('/api/eventos');
    eventos.onopen = () => setConectado(true);
    eventos.onerror = () => setConectado(false);
    eventos.addEventListener('atualizacao', () => { void atualizar(); setRevisao(n => n + 1); });
    return () => { sequencia.current++; eventos.close(); };
  }, [atualizar]);
  useEffect(() => {
    if (!selecionada) return;
    const controle = new AbortController();
    const id = encodeURIComponent(selecionada);
    const mes = new Date().toISOString().slice(0,7);
    Promise.all([buscar<Detalhe>(`/api/filiais/${id}`, controle.signal), buscar<Disponibilidade>(`/api/filiais/${id}/disponibilidade?mes=${mes}`, controle.signal)])
      .then(([filial, disp]) => { setDetalhe(filial); setDisponibilidade(disp); })
      .catch(() => { if (!controle.signal.aborted) setErro('Não foi possível consultar o detalhe.'); });
    return () => controle.abort();
  }, [selecionada, revisao]);
  return <main>
    <header><div><p className="eyebrow">Central de operações</p><h1>Monitor de Filiais</h1><p>Acompanhe batimentos e incidentes das filiais.</p></div><span className={conectado ? 'conexao online' : 'conexao'} role="status">{conectado ? 'Atualização conectada' : 'Reconectando atualização'}</span></header>
    {erro && <p className="erro" role="alert">{erro}</p>}
    <section aria-labelledby="titulo-filiais"><h2 id="titulo-filiais">Filiais <small>{filiais.length}</small></h2>
      {carregado && !erro && !filiais.length && <p>Nenhuma filial cadastrada.</p>}
      <div className="grade">{filiais.map(f => { const estado = estadoFilial(f); return <button key={f.id} className={`cartao ${estado}`} onClick={() => { if (selecionada !== f.id) { setDetalhe(null); setDisponibilidade(null); setSelecionada(f.id); } }} aria-pressed={selecionada === f.id}><span className="etiqueta">{rotulos[estado]}</span><strong>{f.nome}</strong><span>Último sinal: {data(f.recebido_em)}</span><span>{f.ativos.length} incidente(s) ativo(s)</span></button>; })}</div>
    </section>
    {selecionada && <section className="detalhe" aria-labelledby="titulo-detalhe"><div className="linha"><h2 id="titulo-detalhe">{detalhe?.nome ?? 'Carregando filial…'}</h2><button onClick={() => setSelecionada(null)}>Fechar</button></div>
      {detalhe && <><p>Disponibilidade no mês (UTC): <strong>{disponibilidade?.percentual == null ? 'Sem período observado' : `${disponibilidade.percentual.toFixed(2)}%`}</strong></p><p>Último sinal: {data(detalhe.recebido_em)}</p>
      {detalhe.dados && <div className="metricas"><span>CPU <strong>{detalhe.dados.cpu}%</strong></span><span>Memória <strong>{detalhe.dados.memoria}%</strong></span><span>Disco livre <strong>{detalhe.dados.disco}%</strong></span><span>Latência <strong>{detalhe.dados.latencia} ms</strong></span></div>}
      {detalhe.dados && <p>Serviços: {Object.entries(detalhe.dados.servicos).map(([nome, ativo]) => `${nome} (${ativo ? 'ativo' : 'parado'})`).join(', ') || 'Nenhum informado'}</p>}
      <h3>Linha do tempo de incidentes</h3>{detalhe.incidentes.length === 0 ? <p>Nenhum incidente registrado.</p> : <ol className="timeline">{detalhe.incidentes.map(i => <li key={i.id}><strong>{i.tipo}</strong><span>Aberto: {data(i.aberto_em)}</span><span>{i.fechado_em ? `Normalizado: ${data(i.fechado_em)}` : 'Em aberto'}</span></li>)}</ol>}</>}
    </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
