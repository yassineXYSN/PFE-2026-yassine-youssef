import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import GlareHover from '../GlareHover/GlareHover';
import './ProfileViewsChart.css';

const ProfileViewsChart = ({ data, title, value, trend }) => {
  return (
    <GlareHover className="profile-views" borderRadius="1rem">
      <div className="profile-views__header">
        <div>
          <h3>{title}</h3>
          <div className="profile-views__value">
            <span>{value}</span>
            <span className="profile-views__trend">{trend}</span>
          </div>
        </div>
        <div className="profile-views__icon">
          <span className="material-symbols-outlined" aria-hidden="true">
            visibility
          </span>
        </div>
      </div>
      <div className="profile-views__chart">
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#895af6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#895af6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'rgba(251, 191, 36, 0.3)', strokeWidth: 1 }}
              contentStyle={{
                background: '#0f172a',
                border: 'none',
                color: '#f8fafc',
                borderRadius: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#895af6"
              strokeWidth={3}
              fill="url(#viewGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlareHover>
  );
};

export default ProfileViewsChart;
