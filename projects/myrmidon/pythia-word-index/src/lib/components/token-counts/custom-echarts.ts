// https://github.com/xieziyu/ngx-echarts-starter/blob/master/src/app/custom-echarts.ts

import * as echarts from 'echarts/core';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LegendComponent } from 'echarts/components';
import { PieChart } from 'echarts/charts';

// import Marcaron from './marcaron';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  PieChart,
  CanvasRenderer,
  LegendComponent,
]);
// echarts.registerTheme('macarons', Marcaron);

export { echarts };
