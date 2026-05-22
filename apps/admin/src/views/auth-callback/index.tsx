import { defineComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { userApi } from '~/api/user'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { setAdminAuthToken } from '~/utils/admin-auth'

export const AuthCallbackView = defineComponent({
  setup() {
    const route = useRoute()
    const router = useRouter()
    const message = ref('正在完成登录')

    onMounted(async () => {
      const token = String(route.query.token || '')
      const error = String(route.query.error || '')

      if (error) {
        message.value = error
        toast.error(error)
        await router.replace('/login')
        return
      }

      if (!token) {
        message.value = '缺少登录凭证'
        toast.error('缺少登录凭证')
        await router.replace('/login')
        return
      }

      try {
        setAdminAuthToken(token)
        const { ok } = await userApi.checkLogged()
        if (!ok) {
          throw new Error('当前账号不是管理员')
        }

        sessionStorage.setItem(SESSION_WITH_LOGIN, '1')
        toast.success('欢迎回来')
        await router.replace('/dashboard')
      } catch (error: any) {
        message.value = error.message || '登录失败'
        toast.error(message.value)
        await router.replace('/login')
      }
    })

    return () => (
      <div class="flex min-h-screen items-center justify-center text-sm text-white/80">
        {message.value}
      </div>
    )
  },
})

export default AuthCallbackView
