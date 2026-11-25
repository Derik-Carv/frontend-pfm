import { useState } from 'react'
import './LegalDocumentsModal.css'

export type LegalDocKind = 'privacy' | 'terms'

type LegalDocumentsModalProps = {
  initialDoc: LegalDocKind
  dpoEmail?: string
  privacyVersion?: string
  termsVersion?: string
  onClose: () => void
}

export function LegalDocumentsModal({
  initialDoc,
  dpoEmail = 'privacidade@derikdev.cloud',
  privacyVersion = '2026-11-24-v1',
  termsVersion = '2026-11-24-v1',
  onClose,
}: LegalDocumentsModalProps) {
  const [activeDoc, setActiveDoc] = useState<LegalDocKind>(initialDoc)

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
              <span className="legal-modal-meta">Versão vigente: {privacyVersion}</span>

              <h3>1. Papéis no Tratamento (Controlador e Operador)</h3>
              <p>
                A plataforma <strong>Derik Flash (PFM)</strong> atua como <strong>Controladora</strong> dos dados de cadastro, autenticação, aprovação empresarial e auditoria de segurança dos usuários do SaaS, e como <strong>Operadora</strong> (Art. 5º, VII da LGPD) dos dados de clientes finais, serviços e notas fiscais inseridos por cada empresa contratante, a qual figura como Controladora da sua própria carteira.
              </p>

              <h3>2. Dados Tratados e Finalidades</h3>
              <ul>
                <li><strong>Usuários da empresa e solicitantes:</strong> nome completo, CPF, e-mail corporativo, usuário, papel de acesso e senha criptografada (hash) — tratados para autenticação, controle de acesso multi-tenant e recuperação de conta (Art. 7º, V e IX).</li>
                <li><strong>Dados fiscais e operacionais da empresa:</strong> CNPJ, razão social, clientes PF/PJ, movimentações e arquivos PDF de NFS-e — tratados sob instrução da empresa contratante e para cumprimento de obrigações legais e regulatórias (Art. 7º, II e V).</li>
                <li><strong>Segurança e auditoria:</strong> endereço IP, agente de navegador, registro de aceites e trilha de auditoria de ações críticas — tratados em legítimo interesse e cumprimento do dever de segurança (Art. 7º, IX e Art. 46).</li>
              </ul>

              <h3>3. Prazos de Retenção e Obrigação Fiscal</h3>
              <ul>
                <li><strong>Códigos OTP por e-mail:</strong> removidos automaticamente até 24 horas após expiração ou uso.</li>
                <li><strong>Senhas de solicitações pendentes:</strong> descartadas imediatamente da tabela de solicitação no ato de aprovação ou rejeição.</li>
                <li><strong>Solicitações rejeitadas:</strong> expurgadas após 90 dias.</li>
                <li><strong>Documentos e notas fiscais (Art. 16, I da LGPD):</strong> preservados pelo prazo legal tributário mínimo de <strong>5 anos</strong>, mesmo em caso de pedido de anonimização de conta.</li>
              </ul>

              <h3>4. Armazenamento no Navegador (Sem Cookies de Rastreamento)</h3>
              <p>
                Este aplicativo não utiliza cookies de publicidade, analytics comportamental ou rastreamento de terceiros. O armazenamento local (<code>localStorage</code>) é empregado exclusivamente para manter o token de sessão, a empresa selecionada e a preferência de tema claro/escuro.
              </p>

              <h3>5. Subprocessadores e Transferência Internacional (Art. 33)</h3>
              <p>
                Para viabilizar a operação em nuvem, dados estritamente necessários podem trafegar por provedores contratados sob cláusulas de confidencialidade e segurança: <strong>Oracle Cloud Infrastructure</strong> (API e banco de dados), <strong>Vercel</strong> (entrega do aplicativo web), <strong>Provedor SMTP</strong> (envio de códigos e notificações) e <strong>Axiom</strong> (logs técnicos sanitizados sem senhas, CPFs ou tokens).
              </p>

              <h3>6. Direitos do Titular (Art. 18) e Contato do Encarregado (DPO)</h3>
              <p>
                Você pode acessar, corrigir nome/sobrenome, exportar seus dados em JSON e solicitar a anonimização da sua conta diretamente na aba <strong>Privacidade (LGPD)</strong> após o login, ou contatar nosso Encarregado de Dados pelo e-mail <a href={`mailto:${dpoEmail}`}>{dpoEmail}</a>.
              </p>
            </>
          ) : (
            <>
              <span className="legal-modal-meta">Versão vigente: {termsVersion}</span>

              <h3>1. Objeto e Acesso Multi-Tenant</h3>
              <p>
                Estes Termos regulam o uso do sistema <strong>Derik Flash (PFM)</strong> pelas empresas contratantes e seus colaboradores autorizados. O ingresso de novas empresas depende de solicitação validada por e-mail e aprovação expressa do Administrador SaaS.
              </p>

              <h3>2. Responsabilidades da Empresa Contratante (DPA Simplificado)</h3>
              <ul>
                <li>Cabe exclusivamente ao <code>company_admin</code> da empresa cadastrar, revisar permissões e desativar usuários da própria equipe.</li>
                <li>A empresa declara possuir base legal válida sob a LGPD para inserir dados de seus clientes, prestadores e notas fiscais na plataforma.</li>
                <li>Cada usuário é responsável pela guarda de suas credenciais e pelo não compartilhamento de senhas ou códigos OTP.</li>
              </ul>

              <h3>3. Deveres da Plataforma Operadora</h3>
              <ul>
                <li>Manter isolamento lógico estrito por empresa (tenant), criptografia em trânsito (HTTPS/TLS), hash de senhas, mascaramento de CPF nas listagens e registros de auditoria.</li>
                <li>Notificar o Controlador/empresa contratante em prazo célere caso identifique incidente de segurança relevante envolvendo dados do tenant (Art. 48 da LGPD).</li>
              </ul>

              <h3>4. Encerramento e Preservação Legal</h3>
              <p>
                O titular pode desativar e anonimizar sua conta pessoal a qualquer momento (exceto se for o único administrador SaaS ativo), permanecendo resguardados os registros fiscais exigidos por lei por 5 anos (Art. 16, I da LGPD).
              </p>
            </>
          )}
        </div>

        <footer className="legal-modal-footer">
          <span className="legal-modal-dpo">
            Canal DPO / Privacidade: <strong>{dpoEmail}</strong>
          </span>
          <button className="legal-modal-close" onClick={onClose} type="button">
            Entendi
          </button>
        </footer>
      </div>
    </div>
  )
}
