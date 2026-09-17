import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppController } from '../src/app.controller.js'

describe('AppController', () => {
  let controller: AppController

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile()

    controller = moduleRef.get(AppController)
  })

  it('returns the health status', () => {
    expect(controller.health()).toEqual({
      status: 'ok',
      service: 'xplay-web-backend',
    })
  })
})
