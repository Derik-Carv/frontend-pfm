import { useEffect, useState } from 'react'
import { getPublicLegalMetadata, type LegalMetadata } from './services/privacy'
import './LegalDocumentsModal.css'

export type LegalDocKind = 'privacy' | 'terms'

type LegalDocumentsModalProps = {
  initialDoc: LegalDocKind
  dpoEmail?: string
  privacyVersion?: string
  termsVersion?: string
  onClose: () => void
}

const DEFAULT_META: LegalMetadata = {
  termsVersion: '2026-11-24-v2',
  privacyVersion: '2026-11-24-v2',
  controller: {
    name: 'PFM',
    document: null,
    address: null,
    jurisdiction: 'Brasil',
    supportEmail: 'privacidade@derikdev.cloud',
  },
  dpo: {
    name: 'Canal de Privacidade / Encarregado (Agente de Pequeno Porte — Res. CD/ANPD nº 2/2022 e nº 18/2024)',
    email: 'privacidade@derikdev.cloud',
  },
  fiscalRetentionYears: 5,
  auditLogRetentionYears: 5,
  incidentRetentionYears: 5,
  incidentNotificationBusinessDays: 3,
  smallAgentNotificationBusinessDays: 6,
  otpRetentionHours: 24,
  rejectedRequestRetentionDays: 90,
  subprocessors: [
    {
      name: 'Oracle Cloud Infrastructure',
      purpose: 'Hospedagem da API e banco de dados PostgreSQL',
      mechanism: 'Região Brasil / Cláusulas-Padrão Contratuais (Res. CD/ANPD nº 19/2024)',
    },
    {
      name: 'Vercel',
      purpose: 'Hospedagem da aplicação web frontend',
      mechanism: 'Cláusulas-Padrão Contratuais (Res. CD/ANPD nº 19/2024)',
    },
    {
      name: 'Provedor SMTP',
      purpose: 'Envio de códigos OTP, notificações e notas fiscais',
      mechanism: 'Cláusulas-Padrão Contratuais (Res. CD/ANPD nº 19/2024)',
    },
    {
      name: 'Axiom (quando habilitado)',
      purpose: 'Telemetria técnica e logs sanitizados de produção',
      mechanism: 'Cláusulas-Padrão Contratuais (Res. CD/ANPD nº 19/2024) / Adequação UE quando aplicável',
    },
  ],
}

export function LegalDocumentsModal({
  initialDoc,
  dpoEmail,
  privacyVersion,
  termsVersion,
  onClose,
}: LegalDocumentsModalProps) {
  const [activeDoc, setActiveDoc] = useState<LegalDocKind>(initialDoc)
  const [meta, setMeta] = useState<LegalMetadata>(DEFAULT_META)

  useEffect(() => {
    let active = true
    void getPublicLegalMetadata()
      .then((res) => {
        if (active) setMeta(res)
      })
      .catch(() => {
        // fallback para defaults locais se offline
      })
    return () => {
      active = false
    }
  }, [])

  const resolvedDpoName = meta.dpo.name
  const resolvedDpoEmail = dpoEmail || meta.dpo.email
  const resolvedPrivacyVersion = privacyVersion || meta.privacyVersion
  const resolvedTermsVersion = termsVersion || meta.termsVersion
  const { controller } = meta

  return (
    <div className="legal-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Documentos Legais LGPD">
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <header className="legal-modal-header">
          <h2>Transparência &amp; Conformidade LGPD (Lei nº 13.709/2018)</h2>
          <button className="legal-modal-close" onClick={onClose} type="button">
            Fechar
          </button>
        </header>

        <div className="legal-modal-tabs" role="tablist">
          <button
            className={`legal-modal-tab${activeDoc === 'privacy' ? ' is-active' : ''}`}
            onClick={() => setActiveDoc('privacy')}
            role="tab"
            aria-selected={activeDoc === 'privacy'}
            type="button"
          >
            Política de Privacidade
          </button>
          <button
            className={`legal-modal-tab${activeDoc === 'terms' ? ' is-active' : ''}`}
            onClick={() => setActiveDoc('terms')}
            role="tab"
            aria-selected={activeDoc === 'terms'}
            type="button"
          >
            Termos de Uso &amp; DPA
          </button>
        </div>

        <div className="legal-modal-body">
          {activeDoc === 'privacy' ? (
            <>
              <span className="legal-modal-meta">Versão vigente: {resolvedPrivacyVersion}</span>

              <h3>1. Identificação do Responsável e Papéis no Tratamento</h3>
              <p>
                A plataforma é operada por <strong>{controller.name}</strong>
                {controller.document ? ` (CPF/CNPJ: ${controller.document})` : ''}
                {controller.address ? `, com sede/endereço em ${controller.address}` : ''}
                {' '}(e-mail de atendimento: <a href={`mailto:${controller.supportEmail}`}>{controller.supportEmail}</a>).
              </p>
              <p>
                No modelo SaaS multi-tenant, atuamos como <strong>Controladores</strong> dos dados de cadastro, autenticação, aprovação empresarial e auditoria dos usuários da plataforma, e como <strong>Operadores</strong> (Art. 5º, VII da LGPD) dos dados de clientes finais, serviços e notas fiscais inseridos por cada empresa contratante, a qual figura como Controladora da sua própria carteira.
              </p>

              <h3>2. Dados Tratados e Bases Legais (Art. 7º)</h3>
              <ul>
                <li><strong>Usuários da empresa e solicitantes:</strong> nome completo, CPF (mascarado em listagens), e-mail corporativo, usuário, perfil de acesso e senha em hash — tratados para execução de contrato, autenticação multi-tenant e recuperação de conta (Art. 7º, V e IX).</li>
                <li><strong>Dados fiscais e operacionais da empresa:</strong> CNPJ, razão social, clientes PF/PJ, movimentações e arquivos PDF de NFS-e — tratados sob instrução da empresa contratante e para cumprimento de obrigações legais/regulatórias (Art. 7º, II e V).</li>
                <li><strong>Segurança, auditoria e incidentes:</strong> endereço IP, agente de navegador, registro de aceites, trilha de auditoria e registro de incidentes — tratados para cumprimento do dever legal de segurança e prevenção à fraude (Art. 7º, IX, Art. 37 e Art. 46).</li>
              </ul>

              <h3>3. Prazos de Retenção e Obrigação Fiscal</h3>
              <ul>
                <li><strong>Códigos OTP por e-mail:</strong> expurgados automaticamente até {meta.otpRetentionHours} horas após expiração ou uso.</li>
                <li><strong>Senhas de solicitações pendentes:</strong> descartadas imediatamente da tabela de solicitação no ato de aprovação ou rejeição.</li>
                <li><strong>Solicitações rejeitadas:</strong> expurgadas após {meta.rejectedRequestRetentionDays} dias.</li>
                <li><strong>Logs de auditoria e registro de incidentes (Res. CD/ANPD nº 15/2024):</strong> preservados por <strong>{meta.incidentRetentionYears} anos</strong> para rastreabilidade e prestação de contas.</li>
                <li><strong>Documentos e notas fiscais (Art. 16, I da LGPD):</strong> preservados pelo prazo legal tributário mínimo de <strong>{meta.fiscalRetentionYears} anos</strong>, mesmo após anonimização de usuário ou cliente PF.</li>
              </ul>

              <h3>4. Cookies, Fontes e Armazenamento no Navegador</h3>
              <p>
                Este aplicativo <strong>não</strong> utiliza cookies de publicidade, analytics comportamental, pixels ou rastreadores de terceiros. Inclusive as fontes tipográficas da interface são empacotadas localmente na aplicação (sem chamadas externas a CDNs de fontes). O armazenamento local (<code>localStorage</code>) é empregado exclusivamente para manter o token de sessão (sem CPF no payload), a empresa selecionada e o tema claro/escuro.
              </p>

              <h3>5. Transferência Internacional e Subprocessadores (Res. CD/ANPD nº 19/2024)</h3>
              <p>
                Quando houver transferência internacional de dados para infraestrutura ou serviços em nuvem fora do Brasil, ela observa os mecanismos legais do Art. 33 da LGPD e da Resolução CD/ANPD nº 19/2024 (Cláusulas-Padrão Contratuais da ANPD ou decisão de adequação reconhecida, como a da União Europeia):
              </p>
              <ul>
                {meta.subprocessors.map((sub) => (
                  <li key={sub.name}>
                    <strong>{sub.name}:</strong> {sub.purpose} — <em>{sub.mechanism}</em>.
                  </li>
                ))}
              </ul>

              <h3>6. Direitos do Titular (Art. 18) e Encarregado / Canal (Res. CD/ANPD nº 18/2024)</h3>
              <p>
                Você pode acessar, corrigir nome/sobrenome, exportar seus dados em JSON e solicitar a anonimização da sua conta na aba <strong>Privacidade (LGPD)</strong>. Clientes finais PF podem solicitar anonimização diretamente à empresa contratante, executável pelo <code>company_admin</code>.
              </p>
              <p>
                <strong>Responsável / Canal de Privacidade:</strong> {resolvedDpoName} — <a href={`mailto:${resolvedDpoEmail}`}>{resolvedDpoEmail}</a>.
              </p>
            </>
          ) : (
            <>
              <span className="legal-modal-meta">Versão vigente: {resolvedTermsVersion}</span>

              <h3>1. Objeto, Provedor e Acesso Multi-Tenant</h3>
              <p>
                Estes Termos regulam o uso do sistema fornecido por <strong>{controller.name}</strong>
                {controller.document ? ` (CPF/CNPJ: ${controller.document})` : ''} às empresas contratantes e seus colaboradores autorizados. O ingresso de novas empresas depende de solicitação validada por e-mail e aprovação expressa do Administrador SaaS.
              </p>

              <h3>2. Responsabilidades da Empresa Contratante (DPA)</h3>
              <ul>
                <li>Cabe exclusivamente ao <code>company_admin</code> da empresa cadastrar, revisar permissões, desativar usuários da própria equipe e atender solicitações de eliminação/anonimização de clientes PF na aba Clientes.</li>
                <li>A empresa declara possuir base legal válida sob a LGPD para inserir dados de seus clientes, prestadores e notas fiscais na plataforma.</li>
                <li>Cada usuário é responsável pela guarda de suas credenciais e códigos OTP.</li>
              </ul>

              <h3>3. Deveres da Operadora e Incidentes (Res. CD/ANPD nº 15/2024)</h3>
              <ul>
                <li>Manter isolamento lógico estrito por tenant, criptografia em trânsito (HTTPS/TLS), hash de senhas, mascaramento de CPF e trilha de auditoria persistida por {meta.auditLogRetentionYears} anos.</li>
                <li>Comunicar a ANPD e os titulares em até <strong>{meta.incidentNotificationBusinessDays} dias úteis</strong> (ou até <strong>{meta.smallAgentNotificationBusinessDays} dias úteis</strong> quando aplicável o regime diferenciado de Agente de Pequeno Porte — Res. CD/ANPD nº 2/2022 e nº 15/2024) caso ocorra incidente com risco ou dano relevante, mantendo registro interno por {meta.incidentRetentionYears} anos e avisando prontamente o Controlador contratante.</li>
              </ul>

              <h3>4. Encerramento, Preservação Legal e Foro</h3>
              <p>
                O titular pode desativar e anonimizar sua conta pessoal a qualquer momento (exceto se for o único administrador SaaS ativo), permanecendo resguardados os registros fiscais exigidos por lei por {meta.fiscalRetentionYears} anos (Art. 16, I da LGPD). Fica eleito o foro de <strong>{controller.jurisdiction}</strong> para dirimir eventuais controvérsias destes Termos, observadas as normas de proteção de dados vigentes no Brasil.
              </p>
            </>
          )}
        </div>

        <footer className="legal-modal-footer">
          <span className="legal-modal-dpo">
            Canal DPO / Privacidade: <strong>{resolvedDpoEmail}</strong>
          </span>
          <button className="legal-modal-close" onClick={onClose} type="button">
            Entendi
          </button>
        </footer>
      </div>
    </div>
  )
}
