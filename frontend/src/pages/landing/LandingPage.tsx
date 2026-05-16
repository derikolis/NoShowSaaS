import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle, Shield, TrendingDown, Users, BarChart3,
  CheckCircle, Star, ChevronDown, ChevronUp, Menu, X,
  Zap, Bell, Calendar, ArrowRight, Check,
} from 'lucide-react'

// ── Dados ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Shield,
    title: 'Motor de Risco Inteligente',
    desc: 'Cada cliente recebe um score de risco baseado no histórico. Saiba antes do horário quem tem mais chance de faltar.',
  },
  {
    icon: MessageCircle,
    title: 'Lembretes via WhatsApp',
    desc: 'Mensagens automáticas no canal que seus clientes mais usam. Sem app extra, sem esforço manual.',
  },
  {
    icon: TrendingDown,
    title: 'Reduza Faltas em até 70%',
    desc: 'O sistema ajusta os lembretes conforme o risco: clientes de alto risco recebem confirmação com 6h de antecedência.',
  },
  {
    icon: Users,
    title: 'Lista de Espera Automática',
    desc: 'Quando um cliente cancela, o próximo da lista de espera é notificado automaticamente pelo WhatsApp.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard em Tempo Real',
    desc: 'Visualize taxa de faltas, histórico semanal e performance por profissional em um painel claro e objetivo.',
  },
  {
    icon: Calendar,
    title: 'Multi-Profissional',
    desc: 'Gerencie toda a equipe em um só lugar. Cada profissional vê apenas a própria agenda.',
  },
  {
    icon: Zap,
    title: 'Confirmação Automática',
    desc: 'O cliente responde "Sim" ou "Não" direto no WhatsApp. O sistema atualiza o agendamento em tempo real.',
  },
  {
    icon: Bell,
    title: 'Alertas de Cancelamento',
    desc: 'Receba notificação imediata ao cancelar e libere o horário para outro cliente da lista de espera.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Cadastre seus clientes e equipe',
    desc: 'Importe ou cadastre clientes e profissionais em minutos. A plataforma aprende o histórico de cada um automaticamente.',
  },
  {
    step: '02',
    title: 'O sistema avalia o risco de falta',
    desc: 'Cada agendamento recebe um score: clientes novos, horário de pico e histórico de faltas pesam no cálculo.',
  },
  {
    step: '03',
    title: 'WhatsApp faz o trabalho por você',
    desc: 'Lembretes e confirmações são enviados no momento certo. Você só cuida do atendimento.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Carla Mendes',
    role: 'Proprietária',
    business: 'Clínica Estética Bella Forma',
    city: 'São Paulo, SP',
    quote: 'Antes eu tinha 8 a 10 faltas por semana. Com o Kired caiu para 2. Em dois meses recuperei o investimento.',
    rating: 5,
    reduction: '75%',
  },
  {
    name: 'Rafael Costa',
    role: 'Dono',
    business: 'Barbearia Costa & Silva',
    city: 'Belo Horizonte, MG',
    quote: 'Meus clientes adoraram receber lembrete no WhatsApp. É o canal que eles já usam. As confirmações chegam sozinhas.',
    rating: 5,
    reduction: '68%',
  },
  {
    name: 'Dra. Ana Beatriz',
    role: 'Psicóloga',
    business: 'Consultório Ana Beatriz',
    city: 'Curitiba, PR',
    quote: 'Para consultório, falta é prejuízo direto. O score de risco me ajuda a ligar só para quem realmente precisa de atenção.',
    rating: 5,
    reduction: '80%',
  },
]

const PLANS = [
  {
    name: 'Solo',
    price: 79,
    priceYear: 66,
    desc: 'Ideal para profissionais autônomos',
    highlight: false,
    features: [
      '1 profissional',
      'Até 200 clientes',
      'Lembretes via WhatsApp',
      'Motor de risco básico',
      'Dashboard de faltas',
      'Lista de espera',
      'Suporte por e-mail',
    ],
    missing: ['Dashboard avançado', 'Multi-profissional', 'API e integrações'],
  },
  {
    name: 'Equipe',
    price: 149,
    priceYear: 124,
    desc: 'Para salões e clínicas em crescimento',
    highlight: true,
    features: [
      'Até 5 profissionais',
      'Clientes ilimitados',
      'Lembretes via WhatsApp',
      'Motor de risco completo',
      'Dashboard avançado',
      'Lista de espera',
      'Suporte por e-mail e chat',
    ],
    missing: ['API e integrações'],
  },
  {
    name: 'Clínica',
    price: 249,
    priceYear: 207,
    desc: 'Para clínicas e redes com múltiplas unidades',
    highlight: false,
    features: [
      'Profissionais ilimitados',
      'Clientes ilimitados',
      'Lembretes via WhatsApp',
      'Motor de risco + regras personalizadas',
      'Dashboard multi-unidade',
      'Lista de espera',
      'API e integrações',
      'Suporte prioritário',
    ],
    missing: [],
  },
]

const FAQS = [
  {
    q: 'Preciso de cartão de crédito para testar?',
    a: 'Não. Os 7 dias de teste são completamente gratuitos e sem cadastro de cartão. Você só paga se decidir continuar.',
  },
  {
    q: 'O WhatsApp é o número da minha empresa?',
    a: 'Sim. Os lembretes são enviados a partir do número que você configurar — pode ser o WhatsApp Business do seu negócio.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim, sem multa e sem burocracia. Você cancela com um clique nas configurações da conta. Sem fidelidade.',
  },
  {
    q: 'Os dados dos meus clientes estão seguros?',
    a: 'Todos os dados são armazenados com criptografia e tratados conforme a LGPD. Seus clientes e seus dados são seus — nunca os compartilhamos.',
  },
  {
    q: 'Como funciona o motor de risco?',
    a: 'O sistema analisa o histórico de cada cliente: faltas anteriores, tipo de horário e tempo de cadastro geram um score. Quanto maior o risco, mais antecipado é o lembrete.',
  },
  {
    q: 'O que acontece se eu ultrapassar o limite de profissionais?',
    a: 'Avisamos antes e você pode fazer upgrade a qualquer hora. Nunca bloqueamos o sistema sem aviso prévio.',
  },
  {
    q: 'Funciona para qual tipo de negócio?',
    a: 'Para qualquer negócio com agendamento: salões, barbearias, clínicas, consultórios, estúdios de tatuagem, fisioterapeutas e mais.',
  },
  {
    q: 'Tem período mínimo de contrato?',
    a: 'Não. Você assina mês a mês e cancela quando quiser. O plano anual oferece desconto de 2 meses grátis, mas não é obrigatório.',
  },
]

// ── Componentes internos ────────────────────────────────────────────────────────

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left text-gray-900 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span>{q}</span>
        {open ? <ChevronUp size={18} className="text-indigo-600 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100">
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [annual, setAnnual] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-base font-bold text-gray-900 leading-none">Kired</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#funcionalidades" className="hover:text-indigo-600 transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-indigo-600 transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-indigo-600 transition-colors">Preços</a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">Dúvidas</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
              Entrar
            </Link>
            <Link
              to="/register"
              className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Testar grátis
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-gray-600 cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            <a href="#funcionalidades" className="block text-sm font-medium text-gray-700 py-1" onClick={() => setMobileMenuOpen(false)}>Funcionalidades</a>
            <a href="#como-funciona" className="block text-sm font-medium text-gray-700 py-1" onClick={() => setMobileMenuOpen(false)}>Como funciona</a>
            <a href="#precos" className="block text-sm font-medium text-gray-700 py-1" onClick={() => setMobileMenuOpen(false)}>Preços</a>
            <a href="#faq" className="block text-sm font-medium text-gray-700 py-1" onClick={() => setMobileMenuOpen(false)}>Dúvidas</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" className="text-center text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg py-2.5">Entrar</Link>
              <Link to="/register" className="text-center bg-indigo-600 text-white text-sm font-semibold rounded-lg py-2.5">Testar grátis</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white overflow-hidden">
        {/* Decoração de fundo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-800/60 border border-indigo-600/50 rounded-full px-4 py-1.5 text-sm font-medium text-indigo-200 mb-6">
            <Zap size={14} className="text-yellow-400" />
            Sistema de prevenção de faltas com WhatsApp
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Elimine até{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
              70% das faltas
            </span>
            <br className="hidden sm:block" />
            {' '}antes que aconteçam
          </h1>

          <p className="text-lg md:text-xl text-indigo-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Para salões, clínicas e barbearias. O sistema avalia o risco de cada cliente
            e envia lembretes automáticos no WhatsApp — sem trabalho manual.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-colors shadow-lg shadow-green-500/25"
            >
              Começar 7 dias grátis
              <ArrowRight size={18} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 border border-indigo-600 hover:border-indigo-400 text-indigo-200 hover:text-white font-semibold text-base px-8 py-4 rounded-xl transition-colors"
            >
              Ver como funciona
            </a>
          </div>

          <p className="text-sm text-indigo-400">
            7 dias grátis · Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>

        {/* Trust bar */}
        <div className="relative border-t border-indigo-800/60 bg-indigo-950/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-indigo-300">
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" />Dados protegidos pela LGPD</span>
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" />WhatsApp do seu negócio</span>
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" />Configuração em menos de 15 min</span>
            <span className="flex items-center gap-2"><CheckCircle size={15} className="text-green-400" />Suporte em português</span>
          </div>
        </div>
      </section>

      {/* ── Problema (PAS) ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">O problema real</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Cada falta é dinheiro que não volta
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Enquanto você espera por um cliente que não vem, outro poderia estar sendo atendido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                number: 'R$400',
                label: 'perdidos por mês',
                desc: 'Uma falta por semana representa em média R$100 de receita desperdiçada — e mais de R$4.800 por ano.',
                color: 'text-red-600',
              },
              {
                number: '30%',
                label: 'dos agendamentos falham',
                desc: 'No Brasil, quase 1 em cada 3 agendamentos em salões e clínicas termina em no-show ou cancelamento tardio.',
                color: 'text-orange-600',
              },
              {
                number: '2h',
                label: 'por dia em ligações',
                desc: 'A equipe gasta em média 2 horas por dia tentando confirmar manualmente os agendamentos do dia seguinte.',
                color: 'text-yellow-600',
              },
            ].map(({ number, label, desc, color }) => (
              <div key={number} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                <p className={`text-5xl font-bold ${color} mb-1`}>{number}</p>
                <p className="text-gray-900 font-semibold mb-3">{label}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Em 3 passos, sem trabalho manual
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Configure uma vez. O sistema trabalha por você todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Linha de conexão (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200" />

            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="text-center relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-xl font-bold mb-5 shadow-lg shadow-indigo-200 relative z-10">
                  {step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Quero reduzir minhas faltas
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="bg-gray-50 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa para acabar com as faltas
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Um sistema completo pensado para negócios de serviços no Brasil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center mb-4 transition-colors">
                  <Icon size={22} className="text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Resultados reais</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Quem usou, não voltou para o jeito antigo
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, business, city, quote, rating, reduction }) => (
              <div key={name} className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <StarRating count={rating} />
                  <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    -{reduction} faltas
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed mb-6 flex-1">"{quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                    {name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-400">{role} · {business}</p>
                    <p className="text-xs text-gray-400">{city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preços ─────────────────────────────────────────────────────────── */}
      <section id="precos" className="bg-gray-50 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Planos e preços</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Investimento menor que uma falta por semana
            </h2>
            <p className="text-gray-500 mb-8">
              Uma falta por semana custa em média R$400/mês. O plano Solo custa R$79.
            </p>

            {/* Toggle anual/mensal */}
            <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${!annual ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 ${annual ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Anual
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${annual ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>
                  2 meses grátis
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map(({ name, price, priceYear, desc, highlight, features, missing }) => (
              <div
                key={name}
                className={`relative bg-white rounded-2xl border-2 p-7 shadow-sm ${highlight ? 'border-indigo-500 shadow-indigo-100 shadow-lg' : 'border-gray-200'}`}
              >
                {highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
                      Mais popular
                    </span>
                  </div>
                )}

                <p className="text-lg font-bold text-gray-900 mb-1">{name}</p>
                <p className="text-sm text-gray-400 mb-6">{desc}</p>

                <div className="mb-1">
                  <span className="text-4xl font-bold text-gray-900">
                    R${annual ? priceYear : price}
                  </span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </div>
                {annual && (
                  <p className="text-xs text-gray-400 mb-6">
                    Cobrado anualmente (R${priceYear * 12}/ano)
                  </p>
                )}
                {!annual && <div className="mb-6" />}

                <Link
                  to="/register"
                  className={`block text-center font-bold py-3 rounded-xl transition-colors mb-7 ${highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-900 hover:bg-indigo-50 hover:text-indigo-700'}`}
                >
                  Começar agora
                </Link>

                <div className="space-y-2.5">
                  {features.map(f => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                  {missing.map(f => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <X size={16} className="shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center space-y-2">
            <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
              <Shield size={14} className="text-indigo-400" />
              7 dias grátis sem cartão de crédito · Cancele quando quiser · Dados protegidos pela LGPD
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Dúvidas frequentes</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Perguntas e respostas
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map(faq => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-indigo-900 to-indigo-800 py-20 md:py-24 text-white text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-sm font-semibold text-indigo-300 uppercase tracking-widest mb-4">Pronto para começar?</p>
          <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
            Pare de perder dinheiro<br />com faltas hoje mesmo
          </h2>
          <p className="text-lg text-indigo-200 mb-10 leading-relaxed">
            Configure em menos de 15 minutos. Teste por 7 dias sem cartão.<br />
            Se não reduzir suas faltas, cancele sem complicação.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold text-lg px-10 py-4 rounded-xl transition-colors shadow-lg shadow-green-500/20"
          >
            Começar meu teste grátis
            <ArrowRight size={20} />
          </Link>
          <p className="mt-5 text-sm text-indigo-400">
            Sem cartão · Sem contrato · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Shield size={16} className="text-white" />
                </div>
                <span className="text-white font-bold text-base">Kired</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                Sistema de prevenção de faltas para salões, clínicas e barbearias.
                Lembretes automáticos via WhatsApp com motor de risco inteligente.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold text-sm mb-4">Produto</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Dúvidas</a></li>
              </ul>
            </div>

            <div>
              <p className="text-white font-semibold text-sm mb-4">Acesso</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="hover:text-white transition-colors">Criar conta</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Entrar</Link></li>
              </ul>

              <p className="text-white font-semibold text-sm mt-6 mb-2">Suporte</p>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                <MessageCircle size={15} />
                Fale no WhatsApp
              </a>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>© 2026 Kired. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-green-500">
                <Shield size={12} />
                Dados protegidos pela LGPD
              </span>
              <span className="text-gray-600">|</span>
              <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp flutuante ──────────────────────────────────────────────── */}
      <a
        href="https://wa.me/5511999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-400 rounded-full shadow-xl shadow-green-500/30 flex items-center justify-center transition-all hover:scale-105"
        title="Fale conosco no WhatsApp"
      >
        <MessageCircle size={26} className="text-white" />
      </a>
    </div>
  )
}
