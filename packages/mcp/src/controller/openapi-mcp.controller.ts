import { All, Body, Controller, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { OPENAPI_MCP, OpenAPIMcpService } from '../services/openapi-mcp.service';

@Controller()
export class OpenAPIMcpController {
  constructor(@Inject(OPENAPI_MCP) private readonly mcp: OpenAPIMcpService) {}

  @All()
  async handle(@Req() req: any, @Res() res: any, @Body() body?: unknown) {
    if (this.mcp.options.http?.enabled === false) {
      throw new NotFoundException();
    }
    const rawReq = req?.raw ?? req;
    const rawRes = res?.raw ?? res;
    await this.mcp.handleHttp(rawReq, rawRes, body);
  }
}
