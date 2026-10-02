// Parmana's config module imports dotenv at load time; the fixture
// generator never reads configuration, so a no-op stub is enough.
export default { config() { return {}; } }; export const config = () => ({});
