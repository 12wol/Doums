import { PrismaClient } from "@prisma/client";
import { MARD_COLORS } from "../src/data/mard-colors";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.color.count();
  if (existing > 0) {
    console.log(`色号已存在 (${existing} 条)，跳过种子数据`);
    return;
  }

  await prisma.color.createMany({
    data: MARD_COLORS.map((c) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      series: c.series,
    })),
  });

  console.log(`已导入 ${MARD_COLORS.length} 个 MARD 色号`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
