import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const connection = await hre.network.connect();

    const [deployer] = await connection.ethers.getSigners();
    const oracle = deployer;

    const Vybe = await connection.ethers.getContractFactory(
        "VybePredictionMarket"
    );
    const vybe = await Vybe.deploy(oracle.address);
    await vybe.waitForDeployment();

    console.log("VybePredictionMarket:", await vybe.getAddress());
    console.log("Deployer:", deployer.address);
    console.log("Oracle:", oracle.address);
}

main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
});
