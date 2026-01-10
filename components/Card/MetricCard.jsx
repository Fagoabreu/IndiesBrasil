import { Heading } from "@primer/react";
import "./MetricCard.css";

export default function MetricCard({ title, period, value, previousLabel, previousValue, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <Heading as="h4" className="metric-title">
          {title}
        </Heading>

        {icon && <div className="metric-icon">{icon}</div>}
      </div>

      <span className="metric-period">{period}</span>

      <div className="metric-value">{value}</div>

      {previousLabel && (
        <div className="metric-previous">
          {previousLabel}: <strong>{previousValue}</strong>
        </div>
      )}
    </div>
  );
}
