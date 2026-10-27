/** FarmPlans word mark: the wheat-field icon with "Farm" in white and "Plans" in lime (or dark on light backgrounds). */
export function Logo({ size = 40, light = true }: { size?: number; light?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.62 }}>
      <img src="/icon.svg" alt="" width={size} height={size} />
      <span className="logo-word">
        <span style={{ color: light ? '#fff' : 'var(--brand)' }}>Farm</span>
        <span style={{ color: light ? 'var(--lime)' : 'var(--brand-2)' }}>Plans</span>
      </span>
    </span>
  )
}
