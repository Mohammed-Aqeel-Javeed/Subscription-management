import { useContext } from "react";
import { useUser } from "./UserContext";

export const useAbility = () => {
  const { ability } = useUser();
  return ability;
};
