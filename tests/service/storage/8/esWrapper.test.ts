import { errors } from "sdk-es8";

import ESWrapper from "../../../../lib/service/storage/8/esWrapper";
import { describeESWrapper } from "../esWrapperCases";

describeESWrapper("8", ESWrapper as never, errors.ResponseError as never);
