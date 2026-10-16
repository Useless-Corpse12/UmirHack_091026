import { AppRouter } from "./app/router";
import { AuthBootstrap } from "./features/auth/AuthBootstrap";
function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <AuthBootstrap />
      <AppRouter />
    </div>
  );
}
export default App;
