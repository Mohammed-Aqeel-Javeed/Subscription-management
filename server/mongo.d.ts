import { Db } from "mongodb";
export declare function connectToDatabase(): Promise<Db>;
export declare function closeDatabase(): Promise<void>;
