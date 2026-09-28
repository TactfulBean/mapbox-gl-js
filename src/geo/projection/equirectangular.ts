import LngLat from '../lng_lat';
import {clamp} from '../../util/util';
import Projection from './projection';

import type {ProjectionSpecification} from '../../style-spec/types';
import type {ProjectedPoint} from './projection';

export default class Equirectangular extends Projection {

    constructor(options: ProjectionSpecification) {
        super(options);
        this.wrap = true;
        this.supportsWorldCopies = true;
    }

    override project(lng: number, lat: number): ProjectedPoint {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y, z: 0};
    }

    override unproject(x: number, y: number): LngLat {
        const lng = (x - 0.5) * 360;
        const lat = clamp((0.5 - y) * 360, -90, 90);
        return new LngLat(lng, lat);
    }
}
