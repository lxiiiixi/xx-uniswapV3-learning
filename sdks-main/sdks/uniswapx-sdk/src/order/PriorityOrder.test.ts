import { BigNumber, ethers } from "ethers";

import {
  CosignedPriorityOrder,
  CosignedPriorityOrderInfo,
  OrderNotFillable,
  //UnsignedPriorityOrder,
  //UnsignedPriorityOrderInfo,
} from "./PriorityOrder";

const BLOCK = BigNumber.from(100);

const NOW = Math.floor(new Date().getTime() / 1000);
const RAW_AMOUNT = BigNumber.from("1000000");
const INPUT_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const OUTPUT_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("PriorityOrder", () => {
  const getFullOrderInfo = (
    data: Partial<CosignedPriorityOrderInfo>
  ): CosignedPriorityOrderInfo => {
    return Object.assign(
      {
        deadline: NOW + 1000,
        reactor: ethers.constants.AddressZero,
        swapper: ethers.constants.AddressZero,
        nonce: BigNumber.from(10),
        additionalValidationContract: ethers.constants.AddressZero,
        additionalValidationData: "0x",
        cosigner: ethers.constants.AddressZero,
        auctionStartBlock: BLOCK,
        baselinePriorityFeeWei: BigNumber.from(0),
        input: {
          token: INPUT_TOKEN,
          amount: RAW_AMOUNT,
          mpsPerPriorityFeeWei: BigNumber.from(0),
        },
        outputs: [
          {
            token: OUTPUT_TOKEN,
            amount: RAW_AMOUNT,
            mpsPerPriorityFeeWei: BigNumber.from(10),
            recipient: ethers.constants.AddressZero,
          },
        ],
        cosignerData: {
          auctionTargetBlock: BLOCK.sub(2),
        },
        cosignature: "0x",
      },
      data
    );
  };

  it("parses a serialized order", () => {
    const orderInfo = getFullOrderInfo({});
    const order = new CosignedPriorityOrder(orderInfo, 1);
    const serialized = order.serialize();
    const parsed = CosignedPriorityOrder.parse(serialized, 1);
    expect(parsed.info).toEqual(orderInfo);
  });

  it("valid signature over order", async () => {
    const fullOrderInfo = getFullOrderInfo({});
    const order = new CosignedPriorityOrder(fullOrderInfo, 1);
    const wallet = ethers.Wallet.createRandom();

    const { domain, types, values } = order.permitData();
    const signature = await wallet._signTypedData(domain, types, values);
    expect(order.getSigner(signature)).toEqual(await wallet.getAddress());
  });

  describe("resolve", () => {
    it("throws when resolving if current block < auctionTargetBlock", () => {
      let order = new CosignedPriorityOrder(getFullOrderInfo({}), 1);
      expect(() =>
        order.resolve({
          priorityFee: BigNumber.from(1),
          currentBlock: BLOCK.sub(10),
        })
      ).toThrowError(new OrderNotFillable("Target block in the future"));

      order = new CosignedPriorityOrder(
        getFullOrderInfo({
          cosignerData: {
            auctionTargetBlock: BigNumber.from(0),
          },
        }),
        1
      );

      expect(() =>
        order.resolve({
          priorityFee: BigNumber.from(1),
          currentBlock: BLOCK.sub(1),
        })
      ).toThrowError(new OrderNotFillable("Start block in the future"));
    });

    it("resolves at currentBlock", () => {
      const order = new CosignedPriorityOrder(getFullOrderInfo({}), 1);
      const resolved = order.resolve({
        priorityFee: BigNumber.from(1),
        currentBlock: BLOCK,
      });
      expect(resolved.input.token).toEqual(order.info.input.token);
      expect(resolved.input.amount).toEqual(order.info.input.amount);
      expect(resolved.outputs[0].token).toEqual(order.info.outputs[0].token);
      expect(resolved.outputs[0].amount).toEqual(
        order.info.outputs[0].amount.add(1)
      );
    });
  });
});
