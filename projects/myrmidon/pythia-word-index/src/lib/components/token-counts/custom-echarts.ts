// https://github.com/xieziyu/ngx-echarts-starter/blob/master/src/app/custom-echarts.ts

import * as echarts from 'echarts/core';
import {
  AriaComponent,
  TitleComponent,
  TooltipComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LegendComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { PieChart } from 'echarts/charts';

// import Marcaron from './marcaron';

echarts.use([
  AriaComponent,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  PieChart,
  CanvasRenderer,
  LegendComponent,
  // required by labelLayout (hideOverlap)
  LabelLayout,
]);
// echarts.registerTheme('macarons', Marcaron);

export { echarts };
