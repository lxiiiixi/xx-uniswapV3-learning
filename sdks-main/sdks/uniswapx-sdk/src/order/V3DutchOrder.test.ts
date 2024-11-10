import { expect } from "chai";
import { BigNumber, ethers } from "ethers";

import { getEndAmount } from "../utils/dutchBlockDecay";

import { CosignedV3DutchOrder, CosignedV3DutchOrderInfo, UnsignedV3DutchOrder, UnsignedV3DutchOrderInfoJSON } from "./V3DutchOrder";

const TIME= 1725379823;
const BLOCK_NUMBER = 20671221;
const RAW_AMOUNT = BigNumber.from("2121000");
const INPUT_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const OUTPUT_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const CHAIN_ID = 1;

const COSIGNER_DATA_WITH_OVERRIDES = {
    decayStartBlock: BLOCK_NUMBER,
    exclusiveFiller: ethers.constants.AddressZero,
    exclusivityOverrideBps: BigNumber.from(0),
    inputOverride: RAW_AMOUNT,
    outputOverrides: [RAW_AMOUNT.mul(102).div(100)],
};

const COSIGNER_DATA_WITHOUT_OVERRIDES = {
    decayStartBlock: BLOCK_NUMBER,
    exclusiveFiller: ethers.constants.AddressZero,
    exclusivityOverrideBps: BigNumber.from(0),
    inputOverride: BigNumber.from(0),
    outputOverrides: [BigNumber.from(0)],
};

describe("V3DutchOrder", () => {
    const getFullOrderInfo = ( data: Partial<CosignedV3DutchOrderInfo>): CosignedV3DutchOrderInfo => {
        return Object.assign(
            {
                reactor: ethers.constants.AddressZero,
                swapper: ethers.constants.AddressZero,
                nonce: BigNumber.from(21),
                deadline: TIME + 1000,
                additionalValidationContract: ethers.constants.AddressZero,
                additionalValidationData: "0x",
                cosigner: ethers.constants.AddressZero,
                startingBaseFee: BigNumber.from(0),
                cosignerData: COSIGNER_DATA_WITH_OVERRIDES,
                input: {
                    token: INPUT_TOKEN,
                    startAmount: RAW_AMOUNT,
                    curve: {
                        relativeBlocks: [],
                        relativeAmounts: [],
                    },
                    maxAmount: RAW_AMOUNT, //we don't want input to change, we're testing for decaying output
                    adjustmentPerGweiBaseFee: BigNumber.from(0),
                },
                outputs: [
                    {
                        token: OUTPUT_TOKEN,
                        startAmount: RAW_AMOUNT,
                        curve: {
                            relativeBlocks: [1,2,3,4],
                            relativeAmounts: [BigInt(1), BigInt(2), BigInt(3), BigInt(4)], // 1e-18, 2e-18, 3e-18, 4e-18
                        },
                        recipient: ethers.constants.AddressZero,
                        minAmount: RAW_AMOUNT.sub(4),
                        adjustmentPerGweiBaseFee: BigNumber.from(0),
                    },
                ],
                cosignature: "0x",
                },
                data
            );
    };

    const getFullOrderInfoWithoutOverrides: CosignedV3DutchOrderInfo = {
        ...getFullOrderInfo({}),
        cosignerData: COSIGNER_DATA_WITHOUT_OVERRIDES,
    }

    it("Parses a serialized v3 order", () => {
        const orderInfo = getFullOrderInfo({});
        const order = new CosignedV3DutchOrder(orderInfo, CHAIN_ID);
        const seralized = order.serialize();
        const parsed = CosignedV3DutchOrder.parse(seralized, CHAIN_ID);
        expect(parsed.info).to.deep.eq(orderInfo);
    });

    it("Parses a serialized v3 order with negative relativeAmounts", () => {
        const orderInfo = getFullOrderInfo({
            outputs: [
                {
                    token: OUTPUT_TOKEN,
                    startAmount: RAW_AMOUNT,
                    curve: {
                        relativeBlocks: [1,2,3,4],
                        relativeAmounts: [BigInt(-1), BigInt(-2), BigInt(-3), BigInt(-4)],
                    },
                    recipient: ethers.constants.AddressZero,
                    minAmount: BigNumber.from(0),
                    adjustmentPerGweiBaseFee: BigNumber.from(0),
                },
            ],
        });
        const order = new CosignedV3DutchOrder(orderInfo, CHAIN_ID);
        const seralized = order.serialize();
        const parsed = CosignedV3DutchOrder.parse(seralized, CHAIN_ID);
        expect(parsed.info).to.deep.eq(orderInfo);
    });

    it("parses inner v3 order with no cosigner overrides, both input and output curves", () => {
        const orderInfoJSON : UnsignedV3DutchOrderInfoJSON = {
            ...getFullOrderInfo({}),
            nonce: "21",
            startingBaseFee: "0",
            input: {
                token: INPUT_TOKEN,
                startAmount: "1000000",
                curve: {
                    relativeBlocks: [1,2,3,4],
                    relativeAmounts: ["1", "2", "3", "4"],
                },
                maxAmount: "1000001",
                adjustmentPerGweiBaseFee: "0",
            },
            outputs: [
                {
                    token: OUTPUT_TOKEN,
                    startAmount: "1000000",
                    curve: {
                        relativeBlocks: [1,2,3,4],
                        relativeAmounts: ["1", "2", "3", "4"],
                    },
                    recipient: ethers.constants.AddressZero,
                    minAmount: "1000000",
                    adjustmentPerGweiBaseFee: "0",
                },
            ],
        };
        const order = UnsignedV3DutchOrder.fromJSON(orderInfoJSON, CHAIN_ID);
        expect(order.info.input.startAmount.toString()).to.equal("1000000");
        expect(order.info.outputs[0].startAmount.toString()).to.eq("1000000");
    });

    it("valid signature over inner order", async () => {
        const fullOrderInfo = getFullOrderInfo({});
        const order = new UnsignedV3DutchOrder(fullOrderInfo, 1);
        const wallet = ethers.Wallet.createRandom();
    
        const { domain, types, values } = order.permitData();
        const signature = await wallet._signTypedData(domain, types, values);
        expect(order.getSigner(signature)).equal(await wallet.getAddress());
        const fullOrder = CosignedV3DutchOrder.fromUnsignedOrder(
          order,
          fullOrderInfo.cosignerData,
          fullOrderInfo.cosignature
        );
        expect(fullOrder.getSigner(signature)).equal(await wallet.getAddress());
      });

      it("validates cosignature over (hash || cosignerData)", async () => {
        const wallet = ethers.Wallet.createRandom();
        const orderInfo = getFullOrderInfo({
          cosigner: await wallet.getAddress(),
        });
        const order = new UnsignedV3DutchOrder(orderInfo, 1);
        const fullOrderHash = order.cosignatureHash(orderInfo.cosignerData);
        const cosignature = ethers.utils.joinSignature(
            wallet._signingKey().signDigest(fullOrderHash)
        );
        const signedOrder = CosignedV3DutchOrder.fromUnsignedOrder(
          order,
          COSIGNER_DATA_WITH_OVERRIDES,
          cosignature
        );
    
        expect(signedOrder.recoverCosigner()).equal(await wallet.getAddress());
      });

    describe("resolve DutchV3 orders", () => {
        it("resolves before decayStartBlock", () => {
            const order = new CosignedV3DutchOrder(getFullOrderInfo({}), CHAIN_ID);
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER - 1, //no decay yet
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.input.amount).eq(order.info.cosignerData.inputOverride);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            expect(resolved.outputs[0].amount).eq(
              order.info.cosignerData.outputOverrides[0]
            );
        });

        it("resolves with original value when overrides==0", () => {
            const order = new CosignedV3DutchOrder(
                getFullOrderInfo({
                    cosignerData: COSIGNER_DATA_WITHOUT_OVERRIDES,
                }),
                CHAIN_ID
            );
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER - 1, //no decay yet
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.input.amount).eq(order.info.input.startAmount);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            expect(resolved.outputs[0].amount).eq(order.info.outputs[0].startAmount);
        });

        it("resolves at decayStartBlock", () => {
            const order = new CosignedV3DutchOrder(getFullOrderInfo({}), CHAIN_ID);
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER,
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.input.amount).eq(order.info.cosignerData.inputOverride);
            expect(resolved.outputs.length).eq(1);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            expect(resolved.outputs[0].amount).eq(order.info.cosignerData.outputOverrides[0]);
        });

        it("resolves at last decay block without overrides", () => {
            const order = new CosignedV3DutchOrder(getFullOrderInfoWithoutOverrides, CHAIN_ID);
            const relativeBlocks = order.info.outputs[0].curve.relativeBlocks;
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER + relativeBlocks[relativeBlocks.length - 1],
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            const endAmount = getEndAmount({
                decayStartBlock: BLOCK_NUMBER,
                startAmount: order.info.outputs[0].startAmount,
                relativeBlocks: order.info.outputs[0].curve.relativeBlocks,
                relativeAmounts: order.info.outputs[0].curve.relativeAmounts,
            });
            expect(resolved.outputs[0].amount.toNumber()).eq(endAmount.toNumber());
        });

        it("resolves after last decay without overrides", () => {
            const order = new CosignedV3DutchOrder(getFullOrderInfoWithoutOverrides, CHAIN_ID);
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER + 42,
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            const endAmount = getEndAmount({
                decayStartBlock: BLOCK_NUMBER,
                startAmount: order.info.outputs[0].startAmount,
                relativeBlocks: order.info.outputs[0].curve.relativeBlocks,
                relativeAmounts: order.info.outputs[0].curve.relativeAmounts,
            });
            expect(resolved.outputs[0].amount.toNumber()).eq(endAmount.toNumber()); //deep eq on bignumber failed
        });
        //TODO: resolves for overrides
        it("resolves when filler has exclusivity: Before Decay Start", () => {
            const exclusiveFiller = ethers.Wallet.createRandom().address;
            const order = new CosignedV3DutchOrder(
                getFullOrderInfo({
                    cosignerData: {
                        ...COSIGNER_DATA_WITH_OVERRIDES,
                        exclusiveFiller,
                    },
                }),
                CHAIN_ID
            );
            const resolved = order.resolve({
                currentBlock: BLOCK_NUMBER - 1,
                filler: exclusiveFiller,
            });
            expect(resolved.input.token).eq(order.info.input.token);
            expect(resolved.input.amount).eq(order.info.cosignerData.inputOverride);
            expect(resolved.outputs.length).eq(1);
            expect(resolved.outputs[0].token).eq(order.info.outputs[0].token);
            expect(resolved.outputs[0].amount).eq(order.info.cosignerData.outputOverrides[0]);
        });
    });
});
