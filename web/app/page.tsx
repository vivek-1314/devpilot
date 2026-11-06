import React from "react";
import BootLoader from "@/components/bootLoader";
import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Problem from "@/components/problem";
import Features from "@/components/features";
import HowItWorks from "@/components/howItWorks";
import Security from "@/components/security";
import Footer from "@/components/footer";

export default function Home() {
    return (
        <>
            <BootLoader />
            <Navbar />
            <main>
                <Hero />
                <Problem />
                <Features />
                <HowItWorks />
                <Security />
            </main>
            <Footer />
        </>
    );
}