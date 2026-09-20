import { Heading } from "@primer/react";
import Link from "next/link";
import PropTypes from "prop-types";
import "./MetricCard.css";

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  period: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  previousLabel: PropTypes.string,
  previousValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.node,
  // Quando presente, o card inteiro vira um link para a listagem relacionada.
  href: PropTypes.string,
};

/**
 * Card de métrica da landing. Com `href`, o card inteiro é navegável — o
 * número sozinho não comunica que existe uma listagem por trás dele, então o
 * card recebe também a seta como pista visual, além de um rótulo oculto que
 * dá aos leitores de tela a ação ("Ver Usuários") em vez de só o dado.
 */
export default function MetricCard({ title, period, value, previousLabel, previousValue, icon, href }) {
  const content = (
    <>
      <div className="metric-header">
        <Heading as="h3" className="metric-title">
          {title}
        </Heading>

        {icon && <div className="metric-icon">{icon}</div>}
      </div>

      <span className="metric-period">{period}</span>

      <div className="metric-value-row">
        <div className="metric-value">{value}</div>
        {href && (
          <span className="metric-arrow" aria-hidden="true">
            →
          </span>
        )}
      </div>

      {previousLabel && (
        <div className="metric-previous">
          {previousLabel}: <strong>{previousValue}</strong>
        </div>
      )}

      {href && <span className="metric-sr-only">Ver {title}</span>}
    </>
  );

  if (!href) {
    return <div className="metric-card">{content}</div>;
  }

  return (
    <Link href={href} className="metric-card metric-card-link">
      {content}
    </Link>
  );
}
