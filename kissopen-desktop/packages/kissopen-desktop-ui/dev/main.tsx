import { createRoot } from "react-dom/client";
import "./workbenchDocument.css";
import { Workbench } from "./Workbench";

createRoot(document.getElementById("root")!).render(<Workbench />);
