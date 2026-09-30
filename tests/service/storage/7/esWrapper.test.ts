import { errors } from "sdk-es7";

import ESWrapper from "../../../../lib/service/storage/7/esWrapper";
import { describeESWrapper } from "../esWrapperCases";

describeESWrapper("7", ESWrapper as never, errors.ResponseError as never);
