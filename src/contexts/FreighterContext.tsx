"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { isConnected as freighterIsConnected, getPublicKey, requestAccess } from "@stellar/freighter-api";

interface FreighterContextType {
    publicKey: string | null;
    isConnected: boolean;
    isLoading: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    checkConnection: () => Promise<void>;
}

const FreighterContext = createContext<FreighterContextType | undefined>(undefined);

export function FreighterProvider({ children }: { children: ReactNode }) {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const checkConnection = useCallback(async () => {
        setIsLoading(true);
        try {
            const connected = await freighterIsConnected();
            if (connected) {
                const key = await getPublicKey();
                if (key) {
                    setPublicKey(key);
                    setIsConnected(true);
                }
            } else {
                setIsConnected(false);
                setPublicKey(null);
            }
        } catch (error) {
            console.error("Error checking Freighter connection", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkConnection();
    }, [checkConnection]);

    const connectWallet = async () => {
        setIsLoading(true);
        try {
            const access = await requestAccess();
            if (access) {
                await checkConnection();
            } else {
                console.warn("User aborted connection or Freighter is not installed.");
            }
        } catch (error) {
            console.error("Error connecting to Freighter", error);
        } finally {
            setIsLoading(false);
        }
    };

    const disconnectWallet = () => {
        setPublicKey(null);
        setIsConnected(false);
    };

    return (
        <FreighterContext.Provider
            value={{
                publicKey,
                isConnected,
                isLoading,
                connectWallet,
                disconnectWallet,
                checkConnection,
            }}
        >
            {children}
        </FreighterContext.Provider>
    );
}

export function useFreighter() {
    const context = useContext(FreighterContext);
    if (!context) {
        throw new Error("useFreighter must be used within a FreighterProvider");
    }
    return context;
}
