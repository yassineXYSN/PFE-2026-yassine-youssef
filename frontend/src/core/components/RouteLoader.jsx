const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.12) 25%, rgba(148, 163, 184, 0.24) 50%, rgba(148, 163, 184, 0.12) 75%)',
  backgroundSize: '200% 100%',
  animation: 'route-loader-shimmer 1.4s ease-in-out infinite',
};

const blockStyle = (height, width = '100%', extra = {}) => ({
  ...shimmerStyle,
  width,
  height,
  borderRadius: '18px',
  ...extra,
});

const DashboardLoader = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      width: '100%',
    }}
  >
    <div style={blockStyle('72px', '38%')} />
    <div
      style={{
        display: 'grid',
        gap: '1.25rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      <div style={blockStyle('220px')} />
      <div style={blockStyle('220px')} />
      <div style={blockStyle('220px')} />
    </div>
    <div style={blockStyle('360px')} />
  </div>
);

const PageLoader = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      width: 'min(320px, 100%)',
    }}
  >
    <div style={blockStyle('10px', '100%', { borderRadius: '999px' })} />
    <div style={blockStyle('10px', '72%', { borderRadius: '999px' })} />
  </div>
);

const RouteLoader = ({ variant = 'page' }) => (
  <div
    style={{
      minHeight: variant === 'dashboard' ? '100%' : '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: variant === 'dashboard' ? '1.5rem' : '2rem',
      boxSizing: 'border-box',
    }}
  >
    <style>{`
      @keyframes route-loader-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
    {variant === 'dashboard' ? <DashboardLoader /> : <PageLoader />}
  </div>
);

export default RouteLoader;
