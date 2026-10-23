import { mountApplication } from "./mount";
import "./styles.css";

mountApplication(document.getElementById("root")!, import.meta.env);
